//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.1;
pragma experimental ABIEncoderV2;

import "../interfaces/IRecipe.sol";
import "../interfaces/IUniRouter.sol";
import "../interfaces/ILendingRegistry.sol";
import "../interfaces/ILendingLogic.sol";
import "../interfaces/IPieRegistry.sol";
import "../interfaces/IPie.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "hardhat/console.sol";


contract ArbRecipe is Context {
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
        require(_weth != address(0), "WETH_ZERO");
        require(_uniRouter != address(0), "UNI_ROUTER_ZERO");
        require(_sushiRouter != address(0), "SUSHI_ROUTER_ZERO");
        require(_lendingRegistry != address(0), "LENDING_MANAGER_ZERO");
        require(_pieRegistry != address(0), "PIE_REGISTRY_ZERO");

        WETH = IERC20(_weth);
        uniRouter = IUniRouter(_uniRouter);
        sushiRouter = IUniRouter(_sushiRouter);
        lendingRegistry = ILendingRegistry(_lendingRegistry);
        pieRegistry = IPieRegistry(_pieRegistry);
    }

    function arb(address _pie, uint256 _amount) public {

        // if(!pieRegistry.inRegistry(_pie)) {
        //      console.log("Not a PIE");
        //     return;
        // }

        //first wrap eth
        swapUniOrSushi(address(WETH), _pie, _amount);

        IPie pie = IPie(_pie);

        
    }

    function unwrapAndSwapPie(address _pie) internal {
        IPie pie = IPie(_pie);
        (address[] memory tokens, uint256[] memory amounts) = pie.calcTokensForAmount(1 ether);
        pie.exitPool( pie.balanceOf(address(this)) );

        for(uint256 i = 0; i < tokens.length; i ++) {
            swapUnderlying(tokens[i]);
        }

    }

    function swapUnderlying(address _token) internal {

        IERC20 token = IERC20(_token);
        address _underlying = lendingRegistry.wrappedToUnderlying(_token);
        
        if(_underlying != address(0)) {
            // Unwrap
            ILendingLogic lendingLogic = getLendingLogicFromWrapped(_token);
            (address[] memory targets, bytes[] memory data) = lendingLogic.unlend(_token, token.balanceOf( address(this) ));

            //execute unlend transactions
            for(uint256 i = 0; i < targets.length; i ++) {
                (bool success, ) = targets[i].call{ value: 0 }(data[i]);
                require(success, "CALL_FAILED");
            }

            IERC20 underlying = IERC20(_underlying);
            swapUniOrSushi(address(underlying), address(WETH), underlying.balanceOf(address(this)) );
            return;
        }
        
        swapUniOrSushi( address(_token), address(WETH), token.balanceOf(address(this)) );
    }

    function swapUniOrSushi(address _inputToken, address _outputToken, uint256 _outputAmount) internal {
        (uint256 inputAmount, DexChoice dex) = getBestPriceSushiUni(_inputToken, _outputToken, _outputAmount);

        address[] memory route = getRoute(_inputToken, _outputToken);

        IERC20 _inputToken = IERC20(_inputToken);

        // sushi has the best price, buy there
        if(dex == DexChoice.Sushi) {
            _inputToken.approve(address(sushiRouter), 0);
            _inputToken.approve(address(sushiRouter), type(uint256).max);
            sushiRouter.swapTokensForExactTokens(_outputAmount, type(uint256).max, route, address(this), block.timestamp + 1);
        } else {
            _inputToken.approve(address(uniRouter), 0);
            _inputToken.approve(address(uniRouter), type(uint256).max);
            uniRouter.swapTokensForExactTokens(_outputAmount, type(uint256).max, route, address(this), block.timestamp + 1);
        }
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
            return type(uint256).max;
        }
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

    function encodeData(uint256 _outputAmount) external pure returns(bytes memory){
        return abi.encode((_outputAmount));
    }
}