//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "../interfaces/IRecipe.sol";
import "../interfaces/IUniRouter.sol";
import "../interfaces/ILendingRegistry.sol";
import "../interfaces/ILendingLogic.sol";
import "../interfaces/IPieRegistry.sol";
import "../interfaces/IPie.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


contract UniPieRecipe is IRecipe {

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

    }

    function swap(address _inputToken, address _ouputToken, uint256 _outputAmount) public {

    }

    function getPrice(address _inputToken, address _outputToken, uint256 _outputAmount) public returns(uint256)  {

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
            // TODO calc eth first
            return getPricePie(_outputToken, _outputAmount);
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

    function getPriceUniLike(address _inputToken, address _outputToken, uint256 _outputAmount, IUniRouter _router) internal returns(uint256) {
        // if both input and output are not WETH
        if(_inputToken != address(WETH) && _inputToken != address(WETH)) {
            address[] memory route = new address[](3);
            route[0] = _inputToken;
            route[1] = address(WETH);
            route[2] = _outputToken;
            uint256[] memory amounts = _router.getAmountsIn(_outputAmount, route);
            
            // TODO should we use the first or last element
            return amounts[0];
        }

        address[] memory route = new address[](2);
        route[0] = _inputToken;
        route[1] = _outputToken;
        uint256[] memory amounts = _router.getAmountsIn(_outputAmount, route);

        return amounts[0];
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
}