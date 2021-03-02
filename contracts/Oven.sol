//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.1;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; 
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IRecipe.sol"; 


contract Oven is AccessControl {
  using SafeERC20 for IERC20;
  using Math for uint256;

  bytes32 constant public BAKER_ROLE = keccak256(abi.encode("BAKER_ROLE"));
  uint256 constant public MAX_FEE = 10 * 10**16; //10%

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

  struct ViewRound {
    uint256 totalDeposited;
    uint256 totalBakedInput;
    uint256 totalOutput;
  }

  Round[] public rounds;

  mapping(address => uint256[]) userRounds;

  uint256 public fee = 0; //default 0% (10**16 == 1%)
  address public feeReceiver;

  event Deposit(address indexed from, address indexed to, uint256 amount);
  event Withdraw(address indexed from, address indexed to, uint256 inputAmount, uint256 outputAmount);
  event FeeReceiverUpdate(address indexed _previous, address indexed _new);
  event FeeUpdate(uint256 previousFee, uint256 newFee);

  modifier onlyBaker() {
    require(hasRole(BAKER_ROLE, msg.sender), "NOT_BAKER");
    _;
  }

  modifier onlyAdmin() {
    require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "NOT_ADMIN");
    _;
  }

  constructor(address _inputToken, address _outputToken, uint256 _roundSize, address _recipe) {
    inputToken = IERC20(_inputToken);
    outputToken = IERC20(_outputToken);
    roundSize = _roundSize;
    recipe = IRecipe(_recipe);

    // create first empty round
    rounds.push();

    // approve input token
    IERC20(_inputToken).safeApprove(_recipe, type(uint256).max);

    //grant default admin role
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

    //grant baker role
    _setRoleAdmin(BAKER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(BAKER_ROLE, msg.sender);
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
    uint256 roundSize_ = roundSize; //gas saving

    uint256 currentRound = rounds.length - 1;
    uint256 deposited = 0;

    while(deposited < _amount) {
      //if the current round does not exist create it
      if(currentRound >= rounds.length) {
        rounds.push();
      }

      Round storage round = rounds[currentRound];

      uint256 roundDeposit = (_amount - deposited).min(roundSize_ - round.totalDeposited);

      round.totalDeposited += roundDeposit;
      round.deposits[_to] += roundDeposit;

      deposited += roundDeposit;

      pushUserRound(_to, currentRound);

      // if full amount assigned to rounds break the loop
      if(deposited == _amount) {
        break;
      }

      currentRound ++;
    }

    emit Deposit(msg.sender, _to, _amount);
  }

  function pushUserRound(address _to, uint256 _roundId) internal {
    // only push when its not already added
    if(userRounds[_to].length == 0 || userRounds[_to][userRounds[_to].length - 1] != _roundId) {
      userRounds[_to].push(_roundId);
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

      uint256 userRoundOutput;
      if(bakedInput == 0) {
        userRoundOutput = 0;
      } else {
        userRoundOutput = round.totalOutput * bakedInput / round.totalBakedInput;
      }
      
      // unbaked input
      inputAmount += round.deposits[msg.sender] - bakedInput;
      console.log("unbaked input", inputAmount);
      //amount of output the user is entitled to
      outputAmount += userRoundOutput;

      round.totalDeposited -= round.deposits[msg.sender] - bakedInput;
      round.deposits[msg.sender] = 0;
      round.totalBakedInput -= bakedInput;

      // console.log("Round output", round.totalOutput);
      // console.log("outputAmount", outputAmount);

      round.totalOutput -= userRoundOutput;

      //pop of user round
      userRounds[msg.sender].pop();
    }

    if(inputAmount != 0) {
      inputToken.safeTransfer(_to, inputAmount);
    }
    
    if(outputAmount != 0) {
      outputToken.safeTransfer(_to, outputAmount);
    }

    emit Withdraw(msg.sender, _to, inputAmount, outputAmount);
  }

  function bake(bytes calldata _data, uint256[] memory _rounds) external onlyBaker {
    // TODO consider if we should not mint rounds open to deposits or handle otherwise

    uint256 maxInputAmount;

    //get input amount
    for(uint256 i = 0; i < _rounds.length; i ++) {
      
      // prevent round from being baked twice
      if(i != 0) {
        require(_rounds[i] > _rounds[i - 1], "Rounds out of order");
      }

      Round storage round = rounds[_rounds[i]];
      // console.log("round total deposits", round.totalDeposited);
      maxInputAmount += (round.totalDeposited - round.totalBakedInput);
    }

    // subtract fee amount from input
    uint256 maxInputAmountMinusFee = maxInputAmount * (10**18 - fee) / 10**18;

    console.log("Input amound minus fee", maxInputAmountMinusFee);

    //bake
    (uint256 inputUsed, uint256 outputAmount) = recipe.bake(address(inputToken), address(outputToken), maxInputAmountMinusFee, _data);

    uint256 inputUsedRemaining = inputUsed;

    for(uint256 i = 0; i < _rounds.length; i ++) {
      Round storage round = rounds[_rounds[i]];

      uint256 roundInputBaked = (round.totalDeposited - round.totalBakedInput).min(inputUsedRemaining);

      // skip round if it is already baked
      if(roundInputBaked == 0) {
        continue;
      }

  	  uint256 roundInputBakedWithFee = roundInputBaked * 10**18 / (10**18 - fee);
      // console.log(roundInputBaked);

      uint256 roundOutputBaked = outputAmount * roundInputBaked / inputUsed;

      round.totalBakedInput += roundInputBakedWithFee;
      inputUsedRemaining -= roundInputBaked;
      round.totalOutput += roundOutputBaked;

      //sanity check
      require(round.totalBakedInput <= round.totalDeposited, "Input sanity check failed");
    }

    uint256 feeAmount = (inputUsed * 10**18 / (10**18 - fee)) - inputUsed;
    address feeReceiver_ = feeReceiver; //gas saving
    if(feeReceiver_ != address(0) && feeAmount != 0) {
      inputToken.safeTransfer(feeReceiver_, feeAmount);
    }
    
  }

  function setFee(uint256 _newFee) external onlyAdmin {
    require(_newFee <= MAX_FEE, "This fee is too damn high :(");
    emit FeeUpdate(fee, _newFee);
    fee = _newFee;
  }

  function setFeeReceiver(address _feeReceiver) external onlyAdmin {
    emit FeeReceiverUpdate(feeReceiver, _feeReceiver);
    feeReceiver = _feeReceiver;
  }

  function roundInputBalanceOf(uint256 _round, address _of) public view returns(uint256) {
    Round storage round = rounds[_round];
    // if there are zero deposits the input balance of `_of` would be zero too
    if(round.totalDeposited == 0) {
      return 0;
    }
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

  function getUserRoundsCount(address _user) external view returns(uint256) {
    return userRounds[_user].length;
  }

  function getRoundsCount() external view returns(uint256) {
    return rounds.length;
  }

}
