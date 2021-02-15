//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; 
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/Math.sol";

import "./interfaces/IRecipe.sol"; 

// TODO events

contract Oven {
  using SafeERC20 for IERC20;
  using Math for uint256;

  IERC20 immutable inputToken;
  IERC20 immutable outputToken;
  IRecipe immutable recipe;

  uint256 roundSize;

  struct Round {
    uint256 totalDeposited;
    mapping(address => uint256) deposits;

    uint256 totalBakedInput;
    uint256 totalOutput;
  }

  Round[] public rounds;

  mapping(address => uint256[]) userRounds;

  constructor(address _inputToken, address _outputToken, uint256 _roundSize, address _recipe) {
    inputToken = IERC20(_inputToken);
    outputToken = IERC20(_outputToken);
    roundSize = _roundSize;
    recipe = IRecipe(_recipe);

    // create first empty round
    rounds.push();

    // approve input token
    IERC20(_inputToken).safeApprove(_recipe, uint256(-1));
  }

  function deposit(uint256 _amount) external {
    depositTo(_amount, msg.sender);
  }

  function depositTo(uint256 _amount, address _to) public {
    IERC20 inputToken_ = inputToken;
    inputToken_.safeTransferFrom(msg.sender, address(this), _amount);
    _depositTo(_amount, _to);
  }

  function _depositTo(uint256 _amount, address _to) internal {
    Round storage round = rounds[rounds.length - 1];

    uint256 roundSize_ = roundSize; //gas saving

    require(_amount < roundSize_, "Should not use oven for deposits larger than round size");

    IERC20 inputToken_ = inputToken; //gas saving
    
    uint256 depositFirstRound = _amount.min(roundSize_ - round.totalDeposited);

    round.totalDeposited += depositFirstRound;
    round.deposits[_to] += depositFirstRound;

    userRounds[_to].push(rounds.length - 1);

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

  // TODO restrict calling address
  function bake(bytes calldata _data, uint256[] memory _rounds) external {
    // TODO consider if we should not mint rounds open to deposits or handle otherwise
    // TODO fees

    uint256 maxInputAmount;


    //get input amount
    for(uint256 i = 0; i < _rounds.length; i ++) {
      Round storage round = rounds[_rounds[i]];
      console.log("round total deposits", round.totalDeposited);
      maxInputAmount += round.totalDeposited - round.totalBakedInput;
    }
  	
    console.log("maxInputAMount");
    console.log(maxInputAmount);

    //bake
    (uint256 inputUsed, uint256 outputAmount) = recipe.bake(address(inputToken), address(outputToken), maxInputAmount, _data);

    uint256 inputUsedRemaining = inputUsed;

    for(uint256 i = 0; i < _rounds.length; i ++) {
      Round storage round = rounds[_rounds[i]];

      uint256 roundInputBaked = (round.totalDeposited - round.totalBakedInput).min(inputUsedRemaining);

      console.log(roundInputBaked);

      uint256 roundOutputBaked = outputAmount * inputUsed / roundInputBaked;

      round.totalBakedInput += roundInputBaked;
      round.totalOutput += roundOutputBaked;

      //sanity check
      require(round.totalBakedInput <= round.totalDeposited, "Input sanity check failed");
    }

  }

  function roundInputBalanceOf(uint256 _round, address _of) public view returns(uint256) {
    Round storage round = rounds[_round];
    uint256 bakedInput = round.deposits[_of] * round.totalBakedInput / round.totalDeposited;
    return round.deposits[_of] - bakedInput;
  }

  function inputBalanceOf(address _of) public view returns(uint256) {
    uint256 roundsCount = userRounds[_of].length;

    uint256 balance;

    for(uint256 i = 0; i < roundsCount; i ++) {
      balance += roundInputBalanceOf(userRounds[_of][i], _of);
    }

    return balance;
  }

  function roundOutputBalanceOf(uint256 _round, address _of) public view returns(uint256) {
    Round storage round = rounds[_round];

    if(round.totalBakedInput == 0) {
      return 0;
    }

    //amount of input of user baked
    uint256 bakedInput = round.deposits[_of] * round.totalBakedInput / round.totalDeposited;
    //amount of output the user is entitled to
    uint256 userRoundOutput = round.totalOutput * bakedInput / round.totalBakedInput;

    return userRoundOutput;
  }

  function outputBalanceOf(address _of) external view returns(uint256) {
    uint256 roundsCount = userRounds[_of].length;

    uint256 balance;

    for(uint256 i = 0; i < roundsCount; i ++) {
      balance += roundOutputBalanceOf(userRounds[_of][i], _of);
    }

    return balance;
  }

  function getRoundsCount() external view returns(uint256) {
    return rounds.length;
  }

}
