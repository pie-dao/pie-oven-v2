# pie-oven-v2

👩‍🍳👩‍🍳👩‍🍳👩‍🍳👩‍🍳👩‍🍳👨‍🍳👨‍🍳👩‍🍳👩‍🍳👩‍🍳👩‍🍳👨‍🍳

## How to run

```
yarn
yarn compile
yarn test
yarn coverage
```

## Oven

The oven allows `users` to deposit the defined `inputToken` and let the baker batch the input from multiple users into baking `rounds`

## Recipe

The recipe contains the logic for converting the `inputToken` to the `outputToken`. An example using Uniswap and the PieDAO lending adapter can be found [here](contracts/recipes)