//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.1;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol
    ) ERC20 (_name, _symbol) {
        // _setupDecimals(18);
    }

    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external {
        _burn(_from, _amount);
    }
}