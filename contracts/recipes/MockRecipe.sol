//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "../interfaces/IRecipe.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../mocks/MockToken.sol";

contract MockRecipe is IRecipe {
    using SafeERC20 for IERC20;

    uint256 conversionRate = 1 ether; // price is one to one by default
    uint256 percentageBaked = 1 ether; // by default 100% gets baked

    function bake(
        address _inputToken,
        address _outputToken,
        uint256 _maxInput,
        bytes memory _data
    ) external override returns(uint256 inputAmountUsed, uint256 outputAmount) {
        uint256 inputAmountUsed = _maxInput * percentageBaked / 1 ether;
        uint256 outputAmount = inputAmountUsed * conversionRate / 1 ether;

        IERC20 inputToken = IERC20(_inputToken);
        MockToken outputToken = MockToken(_outputToken);

        inputToken.safeTransferFrom(msg.sender, address(this), inputAmountUsed);
        outputToken.mint(msg.sender, outputAmount);

        return (inputAmountUsed, outputAmount);
    }

}