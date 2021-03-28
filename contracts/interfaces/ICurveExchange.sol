//SPDX-License-Identifier: Unlicense

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface ICurveExchange {
    /**
        @notice Perform an token exchange using a specific pool.
        @param _pool Address of the pool to use for the swap
        @param _from: Address of coin being sent.
        @param _to: Address of coin being received.
        @param _amount: Quantity of `_from` being sent.
        @param _expected: Minimum quantity of `_to` received in order for the transaction to succeed.
        @param _receiver: Optional address to transfer the received tokens to. If not specified, defaults to the caller.
        @return Returns the amount of `_to` received in the exchange 
    */
    function exchange(
        address _pool,
        address _from,
        address _to,
        uint256 _amount,
        uint256 _expected,
        address _receiver
    ) external payable returns(uint256);


    /**
        @notice Find the pool offering the best rate for a given swap.
        @param _from: Address of coin being sent.
        @param _to: Address of coin being received.
        @param _amount: Quantity of `_from` being sent.
        @return Returns the address of the pool offering the best rate, and the expected amount received in the swap 
    */
    function get_best_rate(
        address _from,
        address _to,
        uint256 _amount
    ) external view returns(address, uint256);

}