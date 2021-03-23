import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { EthOven__factory, UniPieRecipe__factory } from "../typechain";


task("deploy-uni-pie-recipe")
 .addParam("weth", "Address of the wrapped native token")
 .addParam("uniRouter", "Address of the Uniswap router")
 .addParam("sushiRouter", "Address of the Sushiswap router")
 .addParam("lendingRegistry", "Address of the lending registry")
 .addParam("pieRegistry", "Address of the pie registry")
 .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();

    const recipe = await (new UniPieRecipe__factory(signers[0])).deploy(
        taskArgs.weth,
        taskArgs.uniRouter,
        taskArgs.sushiRouter,
        taskArgs.lendingRegistry,
        taskArgs.pieRegistry
    );

    console.log(`Recipe deployed at: ${recipe.address}`);
});

task("deploy-eth-oven")
    .addParam("weth")
    .addParam("outputToken")
    .addParam("roundSize", "Round size in normal units. 1 == 1 18 decimal token unit")
    .addParam("recipe", "Address of the recipe")
    .setAction(async(taskArgs, {ethers}) => {
    // address _weth,
    // address _outputToken,
    // uint256 _roundSize,
    // address _recipe
    const signers = await ethers.getSigners();

    console.log("Deploying from: ", await signers[0].address);

    const oven = await (new EthOven__factory(signers[0])).deploy();

    await oven.initialize(
        taskArgs.weth,
        taskArgs.outputToken,
        parseEther(taskArgs.roundSize.toString()),
        taskArgs.recipe,
        {gasLimit: 8000000}
    );

    console.log(`Oven deployed at: ${oven.address}`);
});