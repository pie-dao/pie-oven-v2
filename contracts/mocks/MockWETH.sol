//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.1;

import "./MockToken.sol";

contract MockWETH is MockToken {
    constructor(
        string memory _name,
        string memory _symbol
    ) MockToken (_name, _symbol) {
        // _setupDecimals(18);
    }

    receive() external payable {
        _mint(msg.sender, msg.value);
    }
}