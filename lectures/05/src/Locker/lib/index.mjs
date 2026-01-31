import { readFileSync } from "node:fs";
import { join } from "node:path";

import solc from "solc";

export function compileContract(contract){
    // read contract source code
	const content = readFileSync(join('contracts', `${contract}.sol`), "utf8");
	const sources = {};
	sources[`${contract}.sol`] = { content };
  	const input = {
    	language: "Solidity",
    	sources,
    	settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
  	};
    // compile the program
  	const output = JSON.parse(solc.compile(JSON.stringify(input)));
    // show warnings and errors 
    if (output.errors) {
      for (const e of output.errors) {
        console.error(
          `${e.severity.toUpperCase()}: ${e.formattedMessage}`
        );
      }
      // fail hard on errors
      if (output.errors.some((e) => e.severity === "error")) {
        process.exit(1);
      }
    }
    // extract bytecode and abi (interface)
  	const c = output.contracts[`${contract}.sol`][contract];
	const abi = c.abi;
	const bytecode = `0x${c.evm.bytecode.object}`;
    return { abi, bytecode };
}