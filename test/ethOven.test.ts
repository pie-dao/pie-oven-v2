import { expect } from "chai";
import { ethers, network } from "hardhat";
import TimeTraveler from "../utils/TimeTraveler";
import { EthOven__factory } from "../typechain/factories/EthOven__factory";
import { MockWETH__factory } from "../typechain/factories/MockWETH__factory";
import { MockWETH } from "../typechain/MockWETH";
import { EthOven } from "../typechain/EthOven";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { parseEther } from "ethers/lib/utils";
import { constants } from "ethers";
import { MockRecipe, MockRecipe__factory } from "../typechain";

describe("EthOven", function() {
    let signers: SignerWithAddress[];
    let account: string;
    let account2: string;
    let timeTraveler: TimeTraveler;
    let oven: EthOven;
    let inputToken: MockWETH;
    let outputToken: MockWETH;
    let recipe: MockRecipe;
    
    const inputMintAmount = parseEther("1000");
    const roundSize = parseEther("30");

    before(async() => {
        signers = await ethers.getSigners();
        account = signers[0].address;
        account2 = signers[1].address;
        timeTraveler = new TimeTraveler(network.provider);

        const mockTokenFactory = new MockWETH__factory(signers[0])

        //deploy input token
        inputToken = await mockTokenFactory.deploy("input", "input");
        await inputToken.mint(account, inputMintAmount);
        await inputToken.mint(account2, inputMintAmount);

        //deploy output token
        outputToken = await mockTokenFactory.deploy("output", "output");

        //deploy recipe
        recipe = await (new MockRecipe__factory(signers[0])).deploy();

        // TODO consider deploying diffrently if coverage does not work
        oven = await (new EthOven__factory(signers[0])).deploy(inputToken.address, outputToken.address, roundSize, recipe.address) as unknown as EthOven;

        // approvals
        await inputToken.approve(oven.address, constants.MaxUint256);
        await inputToken.connect(signers[1]).approve(oven.address, constants.MaxUint256);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    describe("Deposit", async() => {
        it("Depositing ETH should work", async() => {
            const depositAmount = parseEther("1");

            await oven.depositEth({value: parseEther("1")});

            const ovenUserInputBalance = await oven.inputBalanceOf(account);
            const ovenUserRoundInputBalance = await oven.roundInputBalanceOf(0, account);
            const ovenInputTokenBalance = await inputToken.balanceOf(oven.address);
            const roundsCount = await oven.getRoundsCount();
            const userRoundsCount = await oven.getUserRoundsCount(account);

            expect(ovenUserInputBalance).to.eq(depositAmount);
            expect(ovenUserRoundInputBalance).to.eq(depositAmount);
            expect(ovenInputTokenBalance).to.eq(depositAmount);
            expect(roundsCount).to.eq(1);
            expect(userRoundsCount).to.eq(1);
        });
        it("Depositing ETH using the fallback should work", async() => {
            const depositAmount = parseEther("1");

            await signers[0].sendTransaction({to: oven.address, value: depositAmount})

            const ovenUserInputBalance = await oven.inputBalanceOf(account);
            const ovenUserRoundInputBalance = await oven.roundInputBalanceOf(0, account);
            const ovenInputTokenBalance = await inputToken.balanceOf(oven.address);
            const roundsCount = await oven.getRoundsCount();
            const userRoundsCount = await oven.getUserRoundsCount(account);

            expect(ovenUserInputBalance).to.eq(depositAmount);
            expect(ovenUserRoundInputBalance).to.eq(depositAmount);
            expect(ovenInputTokenBalance).to.eq(depositAmount);
            expect(roundsCount).to.eq(1);
            expect(userRoundsCount).to.eq(1);
        });
        it("Depositing ETH to another address should work", async() => {
            const depositAmount = parseEther("1");
  
            const account2 = signers[1].address;

            await oven.depositEthTo(account2, {value: depositAmount});

            const ovenUserInputBalance = await oven.inputBalanceOf(account2);
            const ovenUserRoundInputBalance = await oven.roundInputBalanceOf(0, account2);
            const ovenInputTokenBalance = await inputToken.balanceOf(oven.address);
            const roundsCount = await oven.getRoundsCount();
            const userRoundsCount = await oven.getUserRoundsCount(account2);

            expect(ovenUserInputBalance).to.eq(depositAmount);
            expect(ovenUserRoundInputBalance).to.eq(depositAmount);
            expect(ovenInputTokenBalance).to.eq(depositAmount);
            expect(roundsCount).to.eq(1);
            expect(userRoundsCount).to.eq(1);
        });
    });

});