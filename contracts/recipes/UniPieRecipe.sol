//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../interfaces/IRecipe.sol";
import "../interfaces/IUniRouter.sol";
import "../interfaces/ILendingRegistry.sol";
import "../interfaces/ILendingLogic.sol";
import "../interfaces/IPieRegistry.sol";
import "../interfaces/IPie.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


contract UniPieRecipe is IRecipe {
    using SafeERC20 for IERC20;

    IERC20 immutable WETH;
    IUniRouter immutable uniRouter;
    IUniRouter immutable sushiRouter;
    ILendingRegistry immutable lendingRegistry;
    IPieRegistry immutable pieRegistry;

    enum DexChoice {Uni, Sushi}

    constructor(
        address _weth,
        address _uniRouter,
        address _sushiRouter,
        address _lendingRegistry,
        address _pieRegistry
    ) {
        WETH = IERC20(_weth);
        uniRouter = IUniRouter(_uniRouter);
        sushiRouter = IUniRouter(_sushiRouter);
        lendingRegistry = ILendingRegistry(_lendingRegistry);
        pieRegistry = IPieRegistry(_pieRegistry);
    }

    function bake(
        address _inputToken,
        address _outputToken,
        uint256 _maxInput,
        bytes memory _data
    ) external override returns(uint256 inputAmountUsed, uint256 outputAmount) {
        IERC20 inputToken = IERC20(_inputToken);
        IERC20 outputToken = IERC20(_outputToken);

        inputToken.safeTransferFrom(msg.sender, address(this), _maxInput);

        (uint256 mintAmount) = abi.decode(_data, (uint256));

        swap(_inputToken, _outputToken, mintAmount);

        uint256 remainingInputBalance = inputToken.balanceOf(address(this));
        if(remainingInputBalance > 0) {
            inputToken.transfer(msg.sender, remainingInputBalance);
        }

        outputAmount = outputToken.balanceOf(address(this));

        outputToken.safeTransfer(msg.sender, outputAmount);

        inputAmountUsed = _maxInput - remainingInputBalance;

        return(inputAmountUsed, outputAmount);
    }

    function swap(address _inputToken, address _outputToken, uint256 _outputAmount) internal {
        if(_inputToken == _outputToken) {
            return;
        }

        // if input is not WETH buy WETH
        if(_inputToken != address(WETH)) {
            uint256 wethAmount = getPrice(address(WETH), _outputToken, _outputAmount);
            swapUniOrSushi(_inputToken, address(WETH), wethAmount);
            swap(address(WETH), _outputToken, _outputAmount);
            return;
        }

        if(pieRegistry.inRegistry(_outputToken)) {
            swapPie(_outputToken, _outputAmount);
            IERC20(_outputToken).safeTransfer(msg.sender, _outputAmount);
            return;
        }

        address underlying = lendingRegistry.wrappedToUnderlying(_outputToken);
        if(underlying != address(0)) {
            // calc amount according to exchange rate
            ILendingLogic lendingLogic = getLendingLogicFromWrapped(_outputToken);
            uint256 exchangeRate = lendingLogic.exchangeRate(_outputToken) + 1; // wrapped to underlying
            uint256 underlyingAmount = _outputAmount * exchangeRate / (10**18) + 1;

            swap(_inputToken, underlying, underlyingAmount);
            (address[] memory targets, bytes[] memory data) = lendingLogic.lend(underlying, underlyingAmount);

            //execute lending transactions
            for(uint256 i = 0; i < targets.length; i ++) {
                (bool success, ) = targets[i].call{ value: 0 }(data[i]);
                require(success, "CALL_FAILED");
            }

            return;
        }

        // else normal swap
        swapUniOrSushi(_inputToken, _outputToken, _outputAmount);
    }

    function swapPie(address _pie, uint256 _outputAmount) internal {
        IPie pie = IPie(_pie);
        (address[] memory tokens, uint256[] memory amounts) = pie.calcTokensForAmount(_outputAmount);

        for(uint256 i = 0; i < tokens.length; i ++) {
            swap(address(WETH), tokens[i], amounts[i]);
            IERC20 token = IERC20(tokens[i]);
            token.approve(_pie, 0);
            token.approve(_pie, amounts[i]);
        }

        pie.joinPool(_outputAmount);
    }

    function swapUniOrSushi(address _inputToken, address _outputToken, uint256 _outputAmount) public {
        (uint256 inputAmount, DexChoice dex) = getBestPriceSushiUni(_inputToken, _outputToken, _outputAmount);

        address[] memory route = getRoute(_inputToken, _outputToken);

        IERC20 _inputToken = IERC20(_inputToken);

        // sushi has the best price, buy there
        if(dex == DexChoice.Sushi) {
            _inputToken.approve(address(sushiRouter), 0);
            _inputToken.approve(address(sushiRouter), uint256(-1));
            sushiRouter.swapTokensForExactTokens(_outputAmount, uint256(-1), route, address(this), block.timestamp + 1);
        } else {
            _inputToken.approve(address(uniRouter), 0);
            _inputToken.approve(address(uniRouter), uint256(-1));
            uniRouter.swapTokensForExactTokens(_outputAmount, uint256(-1), route, address(this), block.timestamp + 1);
        }

    }

    function getPrice(address _inputToken, address _outputToken, uint256 _outputAmount) public returns(uint256)  {

        if(_inputToken == _outputToken) {
            return _outputAmount;
        }

        address underlying = lendingRegistry.wrappedToUnderlying(_outputToken);
        if(underlying != address(0)) {
            // calc amount according to exchange rate
            ILendingLogic lendingLogic = getLendingLogicFromWrapped(_outputToken);
            uint256 exchangeRate = lendingLogic.exchangeRate(_outputToken) + 1; // wrapped to underlying
            uint256 underlyingAmount = _outputAmount * exchangeRate / (10**18) + 1;

            return getPrice(_inputToken, underlying, underlyingAmount);
        }

        // check if token is pie
        if(pieRegistry.inRegistry(_outputToken)) {
            uint256 ethAmount =  getPricePie(_outputToken, _outputAmount);

            // if input was not WETH
            if(_inputToken != address(WETH)) {
                return getPrice(_inputToken, address(WETH), ethAmount);
            }

            return ethAmount;
        }

        // if input and output are not WETH (2 hop swap)
        if(_inputToken != address(WETH) && _outputToken != address(WETH)) {
            (uint256 middleInputAmount,) = getBestPriceSushiUni(address(WETH), _outputToken, _outputAmount);
            (uint256 inputAmount,) = getBestPriceSushiUni(_inputToken, address(WETH), middleInputAmount);

            return inputAmount;
        }

        // else single hop swap
        (uint256 inputAmount,) = getBestPriceSushiUni(_inputToken, _outputToken, _outputAmount);

        return inputAmount;
    }

    function getBestPriceSushiUni(address _inputToken, address _outputToken, uint256 _outputAmount) internal returns(uint256, DexChoice) {
        uint256 sushiAmount = getPriceUniLike(_inputToken, _outputToken, _outputAmount, sushiRouter);
        uint256 uniAmount = getPriceUniLike(_inputToken, _outputToken, _outputAmount, uniRouter);

        if(uniAmount < sushiAmount) {
            return (uniAmount, DexChoice.Uni);
        }

        return (sushiAmount, DexChoice.Sushi);
    }

    function getRoute(address _inputToken, address _outputToken) internal returns(address[] memory route) {
        // if both input and output are not WETH
        if(_inputToken != address(WETH) && _outputToken != address(WETH)) {
            route = new address[](3);
            route[0] = _inputToken;
            route[1] = address(WETH);
            route[2] = _outputToken;
            return route;
        }

        route = new address[](2);
        route[0] = _inputToken;
        route[1] = _outputToken;

        return route;
    }

    function getPriceUniLike(address _inputToken, address _outputToken, uint256 _outputAmount, IUniRouter _router) internal returns(uint256) {
        if(_inputToken == _outputToken) {
            return(_outputAmount);
        }
        
        // TODO this IS an external call but somehow the compiler does not recognize it as such :(
        try _router.getAmountsIn(_outputAmount, getRoute(_inputToken, _outputToken)) returns(uint256[] memory amounts) {
            return amounts[0];
        } catch {
            return uint256(-1);
        }
    }

    // NOTE input token must be WETH
    function getPricePie(address _pie, uint256 _pieAmount) internal returns(uint256) {
        IPie pie = IPie(_pie);
        (address[] memory tokens, uint256[] memory amounts) = pie.calcTokensForAmount(_pieAmount);

        uint256 inputAmount = 0;

        for(uint256 i = 0; i < tokens.length; i ++) {
            inputAmount += getPrice(address(WETH), tokens[i], amounts[i]);
        }

        return inputAmount;
    }

    function getLendingLogicFromWrapped(address _wrapped) internal view returns(ILendingLogic) {
        return ILendingLogic(
                lendingRegistry.protocolToLogic(
                    lendingRegistry.wrappedToProtocol(
                        _wrapped
                    )
                )
        );
    }

    function encodeData(uint256 _outputAmount) external pure returns(bytes memory) {
        return abi.encode((_outputAmount));
    }
}