import { expect } from "chai";
import { ethers, network } from "hardhat";
import TimeTraveler from "../utils/TimeTraveler";
import { Oven__factory } from "../typechain/factories/Oven__factory";
import { MockToken__factory } from "../typechain/factories/MockToken__factory";
import { MockToken } from "../typechain/MockToken";
import { Oven } from "../typechain/Oven";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { parseEther } from "ethers/lib/utils";
import { constants } from "ethers";
import { MockRecipe, MockRecipe__factory } from "../typechain";

describe("Oven", function() {
    let signers: SignerWithAddress[];
    let account: string;
    let timeTraveler: TimeTraveler;
    let oven: Oven;
    let inputToken: MockToken;
    let outputToken: MockToken;
    let recipe: MockRecipe;
    
    const inputMintAmount = parseEther("100");
    const roundSize = parseEther("30");

    before(async() => {
        signers = await ethers.getSigners();
        account = signers[0].address;
        timeTraveler = new TimeTraveler(network.provider);

        const mockTokenFactory = new MockToken__factory(signers[0])

        //deploy input token
        inputToken = await mockTokenFactory.deploy("input", "input");
        await inputToken.mint(account, inputMintAmount);

        //deploy output token
        outputToken = await mockTokenFactory.deploy("output", "output");

        //deploy recipe
        recipe = await (new MockRecipe__factory(signers[0])).deploy();

        // TODO consider deploying diffrently if coverage does not work
        oven = await (new Oven__factory(signers[0])).deploy(inputToken.address, outputToken.address, roundSize, recipe.address) as unknown as Oven;

        // approvals
        await inputToken.approve(oven.address, constants.MaxUint256);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
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

            expect(inputBalanceAfter).to.eq(inputBalanceBefore.sub(depositAmount));
            expect(ovenUserInputBalance).to.eq(depositAmount);
            expect(ovenUserRoundInputBalance).to.eq(depositAmount);
            expect(ovenInputTokenBalance).to.eq(depositAmount);
            expect(roundsCount).to.eq(1);
        });
    });

    describe("bake", async() => {
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
    });

});