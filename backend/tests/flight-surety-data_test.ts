
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const dataContract = 'flight-surety-data';
const appContract = 'flight-surety-app';

const whitelistAppContract = (deployer: Account, sender: Account) => 
    Tx.contractCall(dataContract,'set-whitelisted',[types.principal(deployer.address.concat('.', appContract)), types.bool(true)], sender.address);

const readIsWhitelisted = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(dataContract, "is-whitelisted", [types.principal(deployer.address.concat('.', appContract)),], deployer.address);

Clarinet.test({
    name: "Check if whitelisting App-Contract is working",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        // check not whitelisted
        let check = readIsWhitelisted(chain, deployer);
        check.result.expectBool(false);
        // contract call to whitelist appContract
        let block = chain.mineBlock([
            whitelistAppContract(deployer, deployer),
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        block.receipts[0].result.expectOk().expectBool(true);
        // check whitelisted equals true
        check = readIsWhitelisted(chain, deployer);
        check.result.expectBool(true);
    },
});

Clarinet.test({
    name: "Check if whitelisting doesn't work for not contract owner principals",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;

        let block = chain.mineBlock([
            whitelistAppContract(deployer, wallet1),
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        block.receipts[0].result.expectErr().expectUint(1001);
        
        let check = readIsWhitelisted(chain, deployer);
        check.result.expectBool(false);
    },
});
