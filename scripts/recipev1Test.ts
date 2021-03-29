import { constants, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { IERC20__factory } from "../typechain";

import { V1CompatibleRecipe__factory } from "../typechain/factories/V1CompatibleRecipe__factory";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const PIE = "0x33e18a092a93ff21ad04746c7da12e35d34dc7c4";
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";

const FROM = "0x0f4ee9631f4be0a63756515141281a3e2b293bbe";

const main = async () => {
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [FROM]}
    )

    const signer = ethers.provider.getSigner(FROM);
    const signers = (await ethers.getSigners());
    const recipe = await (new V1CompatibleRecipe__factory(signer)).deploy(
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        "0x9a607dd7Da5fdABf4f53f73a476D99F68172C36D",
        "0x412a5d5eC35fF185D6BfF32a367a985e1FB7c296"
    );
    // const recipe = await (new UniPieRecipe__factory(signer)).attach("0x1AF4f5113FD55360E45C6E9E05Cf2C9918Bfe6A1");

    console.log(`Recipe deployed at: ${recipe.address}`);

    const price = await recipe.callStatic.calcToPie(PIE, parseEther("1"));

    const ethAmount = parseEther("40");
    const mintAmount = ethAmount.mul(parseEther("1")).div(price).mul(100).div(105);
    console.log("mint amount", mintAmount.toString());
    // const data = await recipe.encodeData(ethAmount.mul(parseEther("1")).div(price));

    const inputToken = IERC20__factory.connect(WETH, signer);
    const outputToken = IERC20__factory.connect(PIE, signer);

    await inputToken.approve(recipe.address, constants.MaxUint256);

    // const tx = await recipe.bake(WETH, PIE, ethAmount.mul(105).div(100), data);

    const ethBalanceBefore = await signer.getBalance();

    console.log("doing tx");
    const tx = await recipe.toPie(PIE, mintAmount, {value: ethAmount});
    console.log("tx done");

    const ethBalanceAfter = await signer.getBalance();

    // console.log(tx);

    console.log(price.toString());

    const wATRI = IERC20__factory.connect("0xf037f37f58110933834ca64545e4ffd169736561", signer);

    const wATRIBalance = await wATRI.balanceOf(recipe.address);
    console.log(wATRIBalance.toString());

    console.log("mint amount", utils.formatEther(mintAmount));

    const outputBalanceAfter = await outputToken.balanceOf(FROM);

    console.log(`outputBalanceAfter: ${utils.formatEther(outputBalanceAfter)}`);
    console.log("ETH spend", utils.formatEther(ethBalanceBefore.sub(ethBalanceAfter)));
}

main();