
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const dataContract = 'flight-surety-data';
const appContract = 'flight-surety-app';
const appContractPrincipal = (deployer: Account) => `${deployer.address}.${appContract}`;


const whitelistAppContract = (deployer: Account, sender: Account) => 
    Tx.contractCall(dataContract,'set-whitelisted',[types.principal(deployer.address.concat('.', appContract)), types.bool(true)], sender.address);

const readIsWhitelisted = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(dataContract, "is-whitelisted", [types.principal(deployer.address.concat('.', appContract)),], deployer.address);

const applicationAirlineTx = (chain: Chain, airline: Account, airlineName: string , caller: Account, appSender: string) =>
    Tx.contractCall(dataContract, "application-airline", [types.principal(airline.address), types.some(types.ascii(airlineName)), types.principal(caller.address)], appSender );

const registerAirlineTx = (chain: Chain, airline: Account, caller: string) =>
    Tx.contractCall(dataContract, "register-airline", [types.principal(airline.address)], caller);

const fundAirlineTx = (chain: Chain, airline: Account, caller: string) =>
    Tx.contractCall(dataContract, "fund-airline", [types.principal(airline.address)], caller);




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

Clarinet.test({
    name: "Check application-airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;
        let wallet2 = accounts.get("wallet_2")!;
        let appCaller =  deployer.address.concat('.', appContract)

        let block = chain.mineBlock([
            applicationAirlineTx(chain, wallet2, "Name" , wallet2, deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        console.log("applic::::", block)
        console.log(block.receipts[0].events)
        console.log("Deployer address:::" , deployer.address, typeof(deployer.address))
        console.log("TYPE::::::",typeof(deployer.address.concat('.', appContract)))
        //block.receipts[0].result.expectErr().expectUint(1001);
        //
        //let check = readIsWhitelisted(chain, deployer);
        //check.result.expectBool(false);
    },
});

Clarinet.test({
    name: "Check register-airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;
        let wallet2 = accounts.get("wallet_2")!;
        let appCaller =  deployer.address.concat('.', appContract)

        let block = chain.mineBlock([
            applicationAirlineTx(chain, wallet2, "Name" , wallet2, deployer.address),
            registerAirlineTx(chain, wallet2, deployer.address)
        ]);
        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, 2);
        console.log("register::::", block)
        console.log(block.receipts[0].events)
        //block.receipts[0].result.expectErr().expectUint(1001);
        //
        //let check = readIsWhitelisted(chain, deployer);
        //check.result.expectBool(false);
    },
});

Clarinet.test({
    name: "Check fund-airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;
        let wallet2 = accounts.get("wallet_2")!;
        let appCaller =  deployer.address.concat('.', appContract)

        let block = chain.mineBlock([
            applicationAirlineTx(chain, wallet2, "Name" , wallet2, deployer.address),
            registerAirlineTx(chain, wallet2, deployer.address),
            fundAirlineTx(chain, wallet2, wallet2.address),
        ]);
        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, 2);
        console.log("fund::::", block)
        console.log(block.receipts[0].events)
        console.log(chain.getAssetsMaps())
        //block.receipts[0].result.expectErr().expectUint(1001);
        //
        //let check = readIsWhitelisted(chain, deployer);
        //check.result.expectBool(false);
    },
});