import { expect } from "chai";
import { ethers, network } from "hardhat";
import TimeTraveler from "../utils/TimeTraveler";
import { EthOven__factory } from "../typechain/factories/EthOven__factory";
import { MockToken__factory } from "../typechain/factories/MockToken__factory";
import { MockToken } from "../typechain/MockToken";
import { EthOven } from "../typechain/EthOven";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { parseEther, parseUnits } from "ethers/lib/utils";
import { BigNumber, constants } from "ethers";
import { MockRecipe, MockRecipe__factory } from "../typechain";

describe("Oven", function() {
    let signers: SignerWithAddress[];
    let account: string;
    let account2: string;
    let timeTraveler: TimeTraveler;
    let oven: EthOven;
    let inputToken: MockToken;
    let outputToken: MockToken;
    let recipe: MockRecipe;
    
    const inputMintAmount = parseEther("1000");
    const roundSize = parseEther("30");

    before(async() => {
        signers = await ethers.getSigners();
        account = signers[0].address;
        account2 = signers[1].address;
        timeTraveler = new TimeTraveler(network.provider);

        const mockTokenFactory = new MockToken__factory(signers[0])

        //deploy input token
        inputToken = await mockTokenFactory.deploy("input", "input");
        await inputToken.mint(account, inputMintAmount);
        await inputToken.mint(account2, inputMintAmount);

        //deploy output token
        outputToken = await mockTokenFactory.deploy("output", "output");

        //deploy recipe
        recipe = await (new MockRecipe__factory(signers[0])).deploy();

        // TODO consider deploying diffrently if coverage does not work
        oven = await (new EthOven__factory(signers[0])).deploy() as unknown as EthOven;
        await oven.initialize(inputToken.address, outputToken.address, roundSize, recipe.address);

        // approvals
        await inputToken.approve(oven.address, constants.MaxUint256);
        await inputToken.connect(signers[1]).approve(oven.address, constants.MaxUint256);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    describe("Initializer", async() => {
        let oven: EthOven;

        beforeEach(async() => {
            oven = await (new EthOven__factory(signers[0])).deploy();
        });

        it("_inputToken zero address should fail", async() => {
            await expect(oven.initialize(constants.AddressZero, outputToken.address, roundSize, recipe.address)).to.be.revertedWith("INPUT_TOKEN_ZERO");
        });
        it("_ouputToken zero address should fail", async() => {
            await expect(oven.initialize(inputToken.address, constants.AddressZero, roundSize, recipe.address)).to.be.revertedWith("OUTPUT_TOKEN_ZERO");
        });
        it("_recipe zero address should fail", async() => {
            await expect(oven.initialize(inputToken.address, outputToken.address, roundSize, constants.AddressZero)).to.be.revertedWith("RECIPE_ZERO");
        });
    });

    describe("deposit", async() => {
        it("Depositing when there are no previous rounds and not filling up the round should work", async() => {
            const depositAmount = parseEther("1");

            const inputBalanceBefore = await inputToken.balanceOf(account);
            await oven.deposit(depositAmount);
            const inputBalanceAfter = await inputToken.balanceOf(account);

            const ovenUserInputBalance = await oven.inputBalanceOf(account);
            const ovenUserRoundInputBalance = await oven.roundInputBalanceOf(0, account);
            const ovenInputTokenBalance = await inputToken.balanceOf(oven.address);
            const roundsCount = await oven.getRoundsCount();
            const userRoundsCount = await oven.getUserRoundsCount(account);

            expect(inputBalanceAfter).to.eq(inputBalanceBefore.sub(depositAmount));
            expect(ovenUserInputBalance).to.eq(depositAmount);
            expect(ovenUserRoundInputBalance).to.eq(depositAmount);
            expect(ovenInputTokenBalance).to.eq(depositAmount);
            expect(roundsCount).to.eq(1);
            expect(userRoundsCount).to.eq(1);
        });

        it("Depositing multiple times into a single round should work", async() => {
            const deposit1Amount = parseEther("1");
            const deposit2Amount = parseEther("3");
            const totalDeposit = deposit1Amount.add(deposit2Amount);

            const inputBalanceBefore = await inputToken.balanceOf(account);
            await oven.deposit(deposit1Amount);
            await oven.deposit(deposit2Amount);
            const inputBalanceAfter = await inputToken.balanceOf(account);
            
            const ovenUserInputBalance = await oven.inputBalanceOf(account);
            const ovenUserRoundInputBalance = await oven.roundInputBalanceOf(0, account);
            const ovenInputTokenBalance = await inputToken.balanceOf(oven.address);
            const roundsCount = await oven.getRoundsCount();
            const userRoundsCount = await oven.getUserRoundsCount(account);

            expect(inputBalanceAfter).to.eq(inputBalanceBefore.sub(totalDeposit));
            expect(ovenUserInputBalance).to.eq(totalDeposit);
            expect(ovenUserRoundInputBalance).to.eq(totalDeposit);
            expect(ovenInputTokenBalance).to.eq(totalDeposit);
            expect(roundsCount).to.eq(1);
            expect(userRoundsCount).to.eq(1);
        });

        it("Depositing multiple times into a single round from different rounds should work", async() => {
            const deposit1Amount = parseEther("1");
            const deposit2Amount = parseEther("3");
            const totalDeposit = deposit1Amount.add(deposit2Amount);

            const ovenAccount2 = oven.connect(signers[1]);

            const input1BalanceBefore = await inputToken.balanceOf(account);
            const input2BalanceBefore = await inputToken.balanceOf(account2);
            await oven.deposit(deposit1Amount);
            await ovenAccount2.deposit(deposit2Amount);
            const input1BalanceAfter = await inputToken.balanceOf(account);
            const input2BalanceAfter = await inputToken.balanceOf(account2);

            const ovenUser1InputBalance = await oven.inputBalanceOf(account);
            const ovenUser2InputBalance = await oven.inputBalanceOf(account2);
            const ovenUser1RoundInputBalance = await oven.roundInputBalanceOf(0, account);
            const ovenUser2RoundInputBalance = await oven.roundInputBalanceOf(0, account2);
            const ovenInputTokenBalance = await inputToken.balanceOf(oven.address);
            const roundsCount = await oven.getRoundsCount();
            const userRoundsCount = await oven.getUserRoundsCount(account);

            expect(input1BalanceAfter).to.eq(input1BalanceBefore.sub(deposit1Amount));
            expect(input2BalanceAfter).to.eq(input2BalanceBefore.sub(deposit2Amount));
            expect(ovenUser1InputBalance).to.eq(deposit1Amount);
            expect(ovenUser2InputBalance).to.eq(deposit2Amount);
            expect(ovenUser1RoundInputBalance).to.eq(deposit1Amount);
            expect(ovenUser2RoundInputBalance).to.eq(deposit2Amount);               
            expect(ovenInputTokenBalance).to.eq(totalDeposit);
            expect(roundsCount).to.eq(1);
            expect(userRoundsCount).to.eq(1);
        });

        it("Depositing a larger amount than the round size should generate additional rounds", async() => {
            const depositAmount = roundSize.mul(2);

            const inputBalanceBefore = await inputToken.balanceOf(account);
            await oven.deposit(depositAmount);
            const inputBalanceAfter = await inputToken.balanceOf(account);

            const ovenUserInputBalance = await oven.inputBalanceOf(account);
            const ovenUserRound0InputBalance = await oven.roundInputBalanceOf(0, account);
            const ovenUserRound1InputBalance = await oven.roundInputBalanceOf(0, account);
            const ovenInputTokenBalance = await inputToken.balanceOf(oven.address);
            const roundsCount = await oven.getRoundsCount();
            const userRoundsCount = await oven.getUserRoundsCount(account);

            expect(inputBalanceAfter).to.eq(inputBalanceBefore.sub(depositAmount));
            expect(ovenUserInputBalance).to.eq(depositAmount);
            expect(ovenUserRound0InputBalance).to.eq(depositAmount.div(2));
            expect(ovenUserRound1InputBalance).to.eq(depositAmount.div(2));
            expect(ovenInputTokenBalance).to.eq(depositAmount);
            expect(roundsCount).to.eq(2);
            expect(userRoundsCount).to.eq(2);
        });

        it("Depositing when the current round is already partially baked should create a new round", async() => {
            const depositAmount = parseEther("1");

            await oven.deposit(depositAmount);
            await oven.bake("0x00", [0]);
            await oven.deposit(depositAmount);

            const ovenUserInputBalance = await oven.inputBalanceOf(account);
            const ovenUserRound0OutputBalance = await oven.roundOutputBalanceOf(0, account);
            const ovenUserRound1OutputBalance = await oven.roundOutputBalanceOf(1, account);
            const ovenUserRound0InputBalance = await oven.roundInputBalanceOf(0, account);
            const ovenUserRound1InputBalance = await oven.roundInputBalanceOf(1, account);
            const ovenInputTokenBalance = await inputToken.balanceOf(oven.address);
            const roundsCount = await oven.getRoundsCount();
            const userRoundsCount = await oven.getUserRoundsCount(account);

            expect(ovenUserInputBalance).to.eq(depositAmount);
            expect(ovenUserRound0OutputBalance).to.eq(depositAmount);
            expect(ovenUserRound1OutputBalance).to.eq(0);
            expect(ovenUserRound0InputBalance).to.eq(0);
            expect(ovenUserRound1InputBalance).to.eq(depositAmount);
            expect(ovenInputTokenBalance).to.eq(depositAmount);
            expect(roundsCount).to.eq(2);
            expect(userRoundsCount).to.eq(2);
        });
    });

    describe("bake", async() => {
        it("only baker should be allowed to bake", async() => {
            const depositAmount = parseEther("1");
            await oven.deposit(depositAmount);
            
            await expect(oven.connect(signers[1]).bake("0x00", [0])).to.be.revertedWith("NOT_BAKER");
        });

        it("baking a single round", async() => {
            const depositAmount = parseEther("1");
            await oven.deposit(depositAmount);
            
            await oven.bake("0x00", [0]);

            const roundOutputBalance = await oven.roundOutputBalanceOf(0, account);
            const outputBalance = await oven.outputBalanceOf(account);
            const roundInputBalance = await oven.roundInputBalanceOf(0, account);
            const inputBalance = await oven.inputBalanceOf(account);

            expect(roundOutputBalance).to.eq(depositAmount);
            expect(outputBalance).to.eq(depositAmount);
            expect(roundInputBalance).to.eq(0);
            expect(inputBalance).to.eq(0);  
        });
        it("multi round baking", async() => {
            const depositAmount = roundSize.mul(2);
            await oven.deposit(depositAmount);

            await oven.bake("0x00", [0, 1]);

            const round0OutputBalance = await oven.roundOutputBalanceOf(0, account);
            const round1OutputBalance = await oven.roundOutputBalanceOf(1, account);
            const outputBalance = await oven.outputBalanceOf(account);
            const round0InputBalance = await oven.roundInputBalanceOf(0, account);
            const round1InputBalance = await oven.roundInputBalanceOf(1, account);
            const inputBalance = await oven.inputBalanceOf(account);

            expect(round0OutputBalance).to.eq(depositAmount.div(2));
            expect(round1OutputBalance).to.eq(depositAmount.div(2));
            expect(outputBalance).to.eq(depositAmount);
            expect(round0InputBalance).to.eq(0);
            expect(round1InputBalance).to.eq(0);
            expect(inputBalance).to.eq(0);  
        });

        it("partially baking over multiple rounds", async() => {
            const depositAmount = roundSize.mul(2);
            await oven.deposit(depositAmount);

            await recipe.setPercentageBaked(parseEther("0.5"));
            await oven.bake("0x00", [0, 1]); 

            const round0OutputBalance = await oven.roundOutputBalanceOf(0, account);
            const round1OutputBalance = await oven.roundOutputBalanceOf(1, account);
            const outputBalance = await oven.outputBalanceOf(account);
            const round0InputBalance = await oven.roundInputBalanceOf(0, account);
            const round1InputBalance = await oven.roundInputBalanceOf(1, account);
            const inputBalance = await oven.inputBalanceOf(account);

            expect(round0OutputBalance).to.eq(depositAmount.div(2));
            expect(round1OutputBalance).to.eq(0);
            expect(outputBalance).to.eq(depositAmount.div(2));
            expect(round0InputBalance).to.eq(0);
            expect(round1InputBalance).to.eq(depositAmount.div(2));
            expect(inputBalance).to.eq(depositAmount.div(2));  
        });
        it("Doing two partial bakes of a round should work", async() => {
            const depositAmount = roundSize;
            await oven.deposit(depositAmount);

            await recipe.setPercentageBaked(parseEther("0.5"));
            await oven.bake("0x00", [0]);
            await oven.bake("0x00", [0]);

            const expectedOutputBalance = depositAmount.mul(75).div(100);
            const expectedInputBalance = depositAmount.sub(expectedOutputBalance);

            const roundOutputBalance = await oven.roundOutputBalanceOf(0, account);
            const outputBalance = await oven.outputBalanceOf(account);
            const roundInputBalance = await oven.roundInputBalanceOf(0, account);
            const inputBalance = await oven.inputBalanceOf(account);

            expect(roundOutputBalance).to.eq(expectedOutputBalance);
            expect(outputBalance).to.eq(expectedOutputBalance);
            expect(roundInputBalance).to.eq(expectedInputBalance);
            expect(inputBalance).to.eq(expectedInputBalance);  
        });
        it("Baking the same round twice should skip it", async() => {
            const depositAmount = parseEther("1");
            await oven.deposit(depositAmount);

            await oven.bake("0x00", [0]);
            await oven.bake("0x00", [0]);

            const roundOutputBalance = await oven.roundOutputBalanceOf(0, account);
            const outputBalance = await oven.outputBalanceOf(account);
            const roundInputBalance = await oven.roundInputBalanceOf(0, account);
            const inputBalance = await oven.inputBalanceOf(account);

            expect(roundOutputBalance).to.eq(depositAmount);
            expect(outputBalance).to.eq(depositAmount);
            expect(roundInputBalance).to.eq(0);
            expect(inputBalance).to.eq(0); 
        });
        it("Baking rounds parameter should be ordered", async() => {
            const depositAmount = roundSize.mul(4);
            await oven.deposit(depositAmount);

            await expect(oven.bake("0x00", [1,0,3])).to.be.revertedWith("Rounds out of order");
        });
    });

    describe("withdraw", async() => {
        it("Simple withdraw when fully baked", async() => {
            const depositAmount = parseEther("1");
            await oven.deposit(depositAmount);

            await oven.bake("0x00", [0]);

            oven.withdraw(constants.MaxUint256);
            
            const outputBalance = await oven.outputBalanceOf(account);
            const roundOutputBalance = await oven.roundOutputBalanceOf(0, account);
            const outputTokenBalance = await outputToken.balanceOf(account);

            expect(outputBalance).to.eq(0);
            expect(roundOutputBalance).to.eq(0);
            expect(outputTokenBalance).to.eq(depositAmount);
        });
        it("Simple withdraw when not baked at all", async() => {
            const depositAmount = parseEther("1");
            await oven.deposit(depositAmount);

            const inputTokenBalanceBefore = await inputToken.balanceOf(account);
            const outputTokenBalanceBefore = await outputToken.balanceOf(account);
            
            await oven.withdraw(constants.MaxUint256);

            const inputBalanceAfter = await oven.inputBalanceOf(account);
            const roundInputBalanceAfter = await oven.roundInputBalanceOf(0, account);
            const inputTokenBalanceAfter = await inputToken.balanceOf(account);
            const outputBalanceAfter = await oven.outputBalanceOf(account);
            const roundOutputBalanceAfter = await oven.roundOutputBalanceOf(0, account);
            const outputTokenBalanceAfter = await outputToken.balanceOf(account);

            expect(inputBalanceAfter).to.eq(0);
            expect(roundInputBalanceAfter).to.eq(0);
            expect(inputTokenBalanceAfter).to.eq(inputTokenBalanceBefore.add(depositAmount));
            expect(outputBalanceAfter).to.eq(0);
            expect(roundOutputBalanceAfter).to.eq(0);
            expect(outputTokenBalanceAfter).to.eq(outputTokenBalanceBefore);
        });

        it("Withdraw when baked in 3 rounds", async() => {
            const depositAmount = roundSize.mul(3);
            await oven.deposit(depositAmount);
            await oven.bake("0x00", [0,1,2]);
            
            const inputTokenBalanceBefore = await inputToken.balanceOf(account);
            const outputTokenBalanceBefore = await outputToken.balanceOf(account);

            await oven.withdraw(constants.MaxUint256);

            const inputBalanceAfter = await oven.inputBalanceOf(account);
            const roundInputBalanceAfter = await oven.roundInputBalanceOf(0, account);
            const inputTokenBalanceAfter = await inputToken.balanceOf(account);
            const outputBalanceAfter = await oven.outputBalanceOf(account);
            const roundOutputBalanceAfter = await oven.roundOutputBalanceOf(0, account);
            const outputTokenBalanceAfter = await outputToken.balanceOf(account);

            expect(inputBalanceAfter).to.eq(0);
            expect(roundInputBalanceAfter).to.eq(0);
            expect(inputTokenBalanceAfter).to.eq(inputTokenBalanceBefore);
            expect(outputBalanceAfter).to.eq(0);
            expect(roundOutputBalanceAfter).to.eq(0);
            expect(outputTokenBalanceAfter).to.eq(outputTokenBalanceBefore.add(depositAmount));
        });

        it("Withdraw on partial bake", async() => {
            const depositAmount = parseEther("1");

            const inputTokenBalanceBefore = await inputToken.balanceOf(account);
            const outputTokenBalanceBefore = await outputToken.balanceOf(account);

            await oven.deposit(depositAmount);
            await recipe.setPercentageBaked(parseEther("0.5"));
            await oven.bake("0x00", [0]);
            await oven.withdraw(constants.MaxUint256);

            const inputBalanceAfter = await oven.inputBalanceOf(account);
            const roundInputBalanceAfter = await oven.roundInputBalanceOf(0, account);
            const inputTokenBalanceAfter = await inputToken.balanceOf(account);
            const outputBalanceAfter = await oven.outputBalanceOf(account);
            const roundOutputBalanceAfter = await oven.roundOutputBalanceOf(0, account);
            const outputTokenBalanceAfter = await outputToken.balanceOf(account);

            const expectedAmount = depositAmount.div(2);

            expect(inputBalanceAfter).to.eq(0);
            expect(roundInputBalanceAfter).to.eq(0);
            expect(inputTokenBalanceAfter).to.eq(inputTokenBalanceBefore.sub(expectedAmount));
            expect(outputBalanceAfter).to.eq(0);
            expect(roundOutputBalanceAfter).to.eq(0);
            expect(outputTokenBalanceAfter).to.eq(outputTokenBalanceBefore.add(expectedAmount));
        });
        
        it("Withdraw math accuracy", async() => {
            await recipe.setConversionRate(parseEther("0.5"));

            const depositAmount = parseEther("2");
            await oven.deposit(depositAmount); // deposit 2ETH
            await oven.connect(signers[1]).deposit(parseEther("1")); // deposit 1ETH

            await oven.bake("0x00", [0]); // bake round

            await oven.connect(signers[1]).withdraw(2); // success
            await oven.connect(signers[0]).withdraw(2); // error! revert ERC20: transfer amount exceeds balance
        });

        it("Withdraw should work when depositing into a second round from a diffrent address", async() => {
            await oven.deposit(roundSize.add(1));
            const oven2 = oven.connect(signers[1]);

            const inputTokenBalanceBefore = await inputToken.balanceOf(account2);
            const outputTokenBalanceBefore = await outputToken.balanceOf(account2);

            await oven2.deposit(roundSize); 
            await oven2.withdraw(constants.MaxUint256);

            const inputBalanceAfter = await oven.inputBalanceOf(account2);
            const roundInputBalanceAfter = await oven.roundInputBalanceOf(1, account2);
            const inputTokenBalanceAfter = await inputToken.balanceOf(account2);
            const outputBalanceAfter = await oven.outputBalanceOf(account2);
            const roundOutputBalanceAfter = await oven.roundOutputBalanceOf(1, account2);
            const outputTokenBalanceAfter = await outputToken.balanceOf(account2);

            expect(inputBalanceAfter).to.eq(0);
            expect(roundInputBalanceAfter).to.eq(0);
            expect(inputTokenBalanceAfter).to.eq(inputTokenBalanceBefore);
            expect(outputBalanceAfter).to.eq(0);
            expect(roundOutputBalanceAfter).to.eq(0);
            expect(outputTokenBalanceAfter).to.eq(outputTokenBalanceBefore);
        });

    });

    describe("Fees", async() => {
        it("Setting the fee should work", async() => {
            const fee = parseEther("0.01");
            await oven.setFee(fee);

            const feeValue = await oven.fee();
            expect(feeValue).to.eq(fee);
        });

        it("Setting the fee from a non admin should fail", async() => {
            await expect(oven.connect(signers[1]).setFee(parseEther("0.01"))).to.be.revertedWith("NOT_ADMIN");
        });

        it("Setting the fee higher than the max should fail", async() => {
            await expect(oven.setFee(parseEther("0.11"))).to.be.revertedWith("INVALID_FEE");
        });

        it("Setting the fee beniciary should work", async() => {
            const account2 = signers[1].address;
            await oven.setFeeReceiver(account2);
            
            const feeReceiver = await oven.feeReceiver();

            expect(feeReceiver).to.eq(account2);
        });

        it("Charging the fee should work", async() => {
            const fee = parseEther("0.1"); // 10% fee
            const account2 = signers[2].address;
            const depositAmount = parseEther("1");

            await oven.setFeeReceiver(account2);
            await oven.setFee(fee);

            const inputTokenBalanceBefore = await inputToken.balanceOf(account);
            
            await oven.deposit(depositAmount);
            await oven.bake("0x00", [0]);

            const inputBalanceAfter = await oven.inputBalanceOf(account);
            const roundInputBalanceAfter = await oven.roundInputBalanceOf(0, account);
            const inputTokenBalanceAfter = await inputToken.balanceOf(account);
            const outputBalanceAfter = await oven.outputBalanceOf(account);
            const roundOutputBalanceAfter = await oven.roundOutputBalanceOf(0, account);
            const outputTokenBalanceAfter = await outputToken.balanceOf(account);
            const feeReceiverBalance = await inputToken.balanceOf(account2);
            

            const feeAmount = depositAmount.mul(fee).div(parseEther("1"));
            const expectedAmount = depositAmount.sub(feeAmount);
        
            expect(inputBalanceAfter).to.eq(0);
            expect(roundInputBalanceAfter).to.eq(0);
            expect(inputTokenBalanceAfter).to.eq(inputTokenBalanceBefore.sub(depositAmount));
            expect(outputBalanceAfter).to.eq(expectedAmount);
            expect(roundOutputBalanceAfter).to.eq(expectedAmount);
            expect(outputTokenBalanceAfter).to.eq(0);
            expect(feeReceiverBalance).to.eq(feeAmount);
        });

        it("Charging the fee when no feeReceiver should send it to the baker", async() => {
            const fee = parseEther("0.1"); // 10% fee
            const account2 = signers[2].address;
            const depositAmount = parseEther("1");

            await oven.setFee(fee);

            const inputTokenBalanceBefore = await inputToken.balanceOf(account);
            
            await oven.deposit(depositAmount);
            await oven.bake("0x00", [0]);

            const inputBalanceAfter = await oven.inputBalanceOf(account);
            const roundInputBalanceAfter = await oven.roundInputBalanceOf(0, account);
            const inputTokenBalanceAfter = await inputToken.balanceOf(account);
            const outputBalanceAfter = await oven.outputBalanceOf(account);
            const roundOutputBalanceAfter = await oven.roundOutputBalanceOf(0, account);
            const outputTokenBalanceAfter = await outputToken.balanceOf(account);
            const feeReceiverBalance = await inputToken.balanceOf(account2);
            

            const feeAmount = depositAmount.mul(fee).div(parseEther("1"));
            const expectedAmount = depositAmount.sub(feeAmount);
        
            expect(inputBalanceAfter).to.eq(0);
            expect(roundInputBalanceAfter).to.eq(0);
            expect(inputTokenBalanceAfter).to.eq(inputTokenBalanceBefore.sub(depositAmount).add(feeAmount));
            expect(outputBalanceAfter).to.eq(expectedAmount);
            expect(roundOutputBalanceAfter).to.eq(expectedAmount);
            expect(outputTokenBalanceAfter).to.eq(0);
        });
    });

    describe("Setters", async() => {
        it("Setting the round size should work", async() => {
            const targetRoundSize = parseEther("1000");

            await oven.setRoundSize(targetRoundSize);
            const roundSize = await oven.roundSizeInputAmount();

            expect(roundSize).to.eq(targetRoundSize);
        });

        it("Setting the round size from a non admin should fail", async() => {
            await expect(oven.connect(signers[1]).setRoundSize(parseEther("1000"))).to.be.revertedWith("NOT_ADMIN");
        });

        it("Setting the recipe should work", async() => {
            const targetRecipe = constants.AddressZero;

            await oven.setRecipe(targetRecipe);
            const recipeValue = await oven.recipe();

            expect(recipeValue).to.eq(recipeValue);
        });

        it("Setting the recipe from a non admin should fail", async() => {
            await expect(oven.connect(signers[1]).setRecipe(constants.AddressZero)).to.be.revertedWith("NOT_ADMIN");
        });
    });

    describe("Token Saving", async() => {
        it("Saving tokens", async() => {
            const depositAmount = parseEther("1");
            await oven.deposit(depositAmount);

            await oven.saveToken(inputToken.address, signers[2].address, depositAmount);

            const ovenBalanceAfter = await inputToken.balanceOf(oven.address);
            const toBalanceAfter = await inputToken.balanceOf(signers[2].address);

            expect(ovenBalanceAfter).to.eq(0);
            expect(toBalanceAfter).to.eq(depositAmount);
        });

        it("Saving tokens from a non admin should fail", async() => {
            await expect(oven.connect(signers[1]).saveToken(inputToken.address, signers[1].address, parseEther("1"))).to.be.revertedWith("NOT_ADMIN");
        });

        it("Saving ETH should work", async() => {
            const depositAmount = parseEther("1");
            await signers[0].sendTransaction({to: oven.address, value: depositAmount});

            const toBalanceBefore = await signers[0].provider?.getBalance(signers[2].address) as BigNumber;
            await oven.saveEth(signers[2].address, depositAmount);
            const toBalanceAfter = await signers[0].provider?.getBalance(signers[2].address);
            
            expect(toBalanceAfter).to.eq(toBalanceBefore.add(depositAmount));
        });

        it("Saving ETH from a non admin should fail", async() => {
            await expect(oven.connect(signers[1]).saveEth(signers[0].address, parseEther("1"))).to.be.revertedWith("NOT_ADMIN");
        });
        
    });

});