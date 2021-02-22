//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../interfaces/IRecipe.sol";
import "../interfaces/IPieRegistry.sol";
import "../interfaces/IPie.sol";
import "../interfaces/ICurveAddressProvider.sol";
import "../interfaces/ICurveExchange.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CurveRecipe is IRecipe {
    using SafeERC20 for IERC20;

    ICurveAddressProvider immutable curveAddressProvider;
    IPieRegistry immutable pieRegistry;

    constructor(
        address _addressProvider,
        address _pieRegistry
    ) {
        curveAddressProvider = ICurveAddressProvider(_addressProvider);
        pieRegistry = IPieRegistry(_pieRegistry);
    }

    function bake(
        address _inputToken,
        address _outputToken,
        uint256 _maxInput,
        bytes memory _
    ) external override returns(uint256 inputAmountUsed, uint256 outputAmount) {
        IERC20 inputToken = IERC20(_inputToken);
        IERC20 outputToken = IERC20(_outputToken);

        inputToken.safeTransferFrom(msg.sender, address(this), _maxInput);
        
        _bake(_inputToken, _outputToken, _maxInput);

        uint256 remainingInput = inputToken.balanceOf(address(this));
        inputAmountUsed = _maxInput - remainingInput;
        
        if(remainingInput > 0) {
            inputToken.safeTransfer(msg.sender, remainingInput);
        }

        outputAmount = outputToken.balanceOf(address(this));
        outputToken.safeTransfer(msg.sender, outputAmount);
    }

    function _bake(
        address _inputToken,
        address _outputToken,
        uint256 _maxInput
    ) internal {
        require(_inputToken != _outputToken, "Input token should be different from output token");
        require(pieRegistry.inRegistry(_outputToken), "Output token is not a PIE");

        IPie pie = IPie(_outputToken);
        ICurveExchange _exchange = ICurveExchange(curveAddressProvider.get_address(2));

        (address[] memory tokens, uint256[] memory amounts) = pie.calcTokensForAmount(_maxInput);

        IERC20(_inputToken).approve(address(_exchange), 0);
        IERC20(_inputToken).approve(address(_exchange), _maxInput);

        for(uint i = 1; i < tokens.length; i++) {
            (address pool, uint256 amount) = _exchange.get_best_rate(_inputToken, tokens[i], amounts[i]);
            _exchange.exchange(pool, _inputToken, tokens[i], amounts[i], amount, address(this));
        }

        for(uint i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).approve(address(pie), 0);
            IERC20(tokens[i]).approve(address(pie), amounts[i]);
        }

        pie.joinPool(_maxInput);
    }
}