//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; 
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/Math.sol";

contract Oven {
  using SafeERC20 for IERC20;
  using Math for uint256;

  IERC20 immutable inputToken;
  IERC20 immutable outputToken;

  uint256 roundSize;

  struct Round {
    uint256 totalDeposited;
    mapping(address => uint256) deposits;

    uint256 totalBakedInput;
    uint256 totalOutput;
  }

  Round[] public rounds;

  mapping(address => uint256[]) userRounds;

  constructor(address _inputToken, address _outputToken) {
    inputToken = IERC20(_inputToken);
    outputToken = IERC20(_outputToken);
  }

  function deposit(uint256 _amount) external {
    depositTo(_amount, msg.sender);
  }

  function depositTo(uint256 _amount, address _to) public {
    Round storage round = rounds[rounds.length - 1];

    uint256 roundSize_ = roundSize; //gas saving

    require(_amount < roundSize_, "Should not use oven for deposits larger than round size");

    IERC20 inputToken_ = inputToken; //gas saving
    
    inputToken_.safeTransferFrom(msg.sender, address(this), _amount);
    
    uint256 depositFirstRound = _amount.min(roundSize - round.totalDeposited);

    round.totalDeposited += depositFirstRound;
    round.deposits[_to] += depositFirstRound;

    //If full amount was not deposited in a single tx
    if(depositFirstRound != _amount) {
      uint256 depositSecondRound = _amount - depositFirstRound;

      rounds.push();
      Round storage round2 = rounds[rounds.length - 1];


      round.totalDeposited = depositSecondRound;
      round.deposits[_to] = depositSecondRound;

      // TODO consider keeping track of rounds a user is in onchain
      userRounds[_to].push(rounds.length - 1);
    }
  }

  function withdraw(uint256 _roundsLimit) public {
    withdrawTo(msg.sender, _roundsLimit);
  }


  // Note: Both input and output are withdrawed at the same time to mittigate any accounting issues
  function withdrawTo(address _to, uint256 _roundsLimit) public {
    uint256 inputAmount;
    uint256 outputAmount;
    
    uint256 userRoundsLength = userRounds[msg.sender].length;
    uint256 numRounds = userRoundsLength.min(_roundsLimit);

    for(uint256 i = 0; i < numRounds; i ++) {
      // start at end of array for efficient popping of elements
      uint256 roundIndex = userRoundsLength - i - 1;

      Round storage round = rounds[roundIndex];

      //amount of input of user baked
      uint256 bakedInput = round.deposits[msg.sender] * round.totalBakedInput / round.totalDeposited;
      //amount of output the user is entitled to
      uint256 userRoundOutput = round.totalOutput * bakedInput / round.totalBakedInput;

      // unbaked input
      inputAmount += round.deposits[msg.sender] - bakedInput;
      //amount of output the user is entitled to
      outputAmount += userRoundOutput;

      round.totalDeposited -= round.deposits[msg.sender] - bakedInput;
      round.deposits[msg.sender] = 0;
      round.totalBakedInput -= bakedInput;
      round.totalOutput -= outputAmount;

      //pop of user round
      userRounds[msg.sender].pop();
    }

    if(inputAmount != 0) {
      inputToken.safeTransfer(_to, inputAmount);
    }
    
    if(outputAmount != 0) {
      outputToken.safeTransfer(_to, outputAmount);
    }

  }

  

  function bake(bytes32 data, uint256[] memory _rounds) external {

  }

}
