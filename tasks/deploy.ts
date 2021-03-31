import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { EthOven__factory, UniPieRecipe__factory, V1CompatibleRecipe__factory } from "../typechain";


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

task("deploy-recipe", async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();

    console.log(signers[0].address);

    const recipe = await (new UniPieRecipe__factory(signers[0])).deploy(
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        "0x9a607dd7Da5fdABf4f53f73a476D99F68172C36D",
        "0x412a5d5eC35fF185D6BfF32a367a985e1FB7c296"
    );

    console.log(`Recipe deployed at: ${recipe.address}`);
})

task("deploy-v1-recipe", async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();

    const recipe = await (new V1CompatibleRecipe__factory(signers[0])).deploy(
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        "0x9a607dd7Da5fdABf4f53f73a476D99F68172C36D",
        "0x412a5d5eC35fF185D6BfF32a367a985e1FB7c296"
    );

    console.log(`Recipe deployed at: ${recipe.address}`);
});