//SPDX-License-Identifier: Unlicense

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface ICurveAddressProvider {
    /**
        @notice Fetch the address associated with `id`.
        @param _id index of the address to fetch
        @return address associated with `_id`
    */
    function get_address(uint256 _id) external view returns(address);

}