
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const dataContract = 'flight-surety-data';
const appContract = 'flight-surety-app';


// read-only functions
const readIsWhitelisted = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(dataContract, "is-whitelisted", [types.principal(deployer.address.concat('.', appContract)),], deployer.address);

const isAirline = (chain: Chain, airline: Account, sender: Account, state: number) =>
    chain.callReadOnlyFn(dataContract, "has-airline-state", [types.principal(airline.address),types.uint(state)], sender.address);

// public functions
const whitelistAppContract = (deployer: Account, sender: Account) => 
    Tx.contractCall(dataContract,'set-whitelisted',[types.principal(deployer.address.concat('.', appContract)), types.bool(true)], sender.address);

const applicationAirlineTx = (chain: Chain, airline: Account, airlineName: string , caller: Account, appSender: string) =>
    Tx.contractCall(dataContract, "application-airline", [types.principal(airline.address), types.some(types.ascii(airlineName)), types.principal(caller.address)], appSender );

const registerAirlineTx = (chain: Chain, airline: Account, caller: string) =>
    Tx.contractCall(dataContract, "register-airline", [types.principal(airline.address)], caller);

const fundAirlineTx = (chain: Chain, airline: Account, caller: string) =>
    Tx.contractCall(dataContract, "fund-airline", [types.principal(airline.address)], caller);



// *** unit tests *** //
// whitelist app contract
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
        let airline1 = accounts.get("airline_1")!;

        let block = chain.mineBlock([
            whitelistAppContract(deployer, airline1),
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        block.receipts[0].result.expectErr().expectUint(1001);
        
        let check = readIsWhitelisted(chain, deployer);
        check.result.expectBool(false);
    },
});

// airlines
// check if arirline is registered on deployment
Clarinet.test({
    name: "Check airline registered on deployment",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let airline1 = accounts.get("airline_1")!;

        assertEquals(chain.blockHeight, 1);

        let read = isAirline(chain, airline1, deployer, 2)
        read.result.expectBool(true);

        read = isAirline(chain, deployer, deployer, 2)
        read.result.expectBool(false);
    },
});
// airline to application

// airline register 

// airline funding

Clarinet.test({
    name: "Check application-airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let airline1 = accounts.get("airline_1")!;
        let wallet2 = accounts.get("wallet_2")!;
        let appCaller =  deployer.address.concat('.', appContract)

        let block = chain.mineBlock([
            applicationAirlineTx(chain, wallet2, "Name" , wallet2, airline1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        
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
        let airline1 = accounts.get("airline_1")!;
        let wallet2 = accounts.get("wallet_2")!;


        let block = chain.mineBlock([
            applicationAirlineTx(chain, wallet2, "Name" , airline1, airline1.address),
            registerAirlineTx(chain, wallet2, deployer.address)
        ]);
        console.log("register::::", block)
        console.log(block.receipts[0].events)
        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, 2);
       
        //console.log(block.receipts[1].events)
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
        let airline1 = accounts.get("airline_1")!;
        let wallet2 = accounts.get("wallet_2")!;
        let appCaller =  deployer.address.concat('.', appContract)

        let block = chain.mineBlock([
            applicationAirlineTx(chain, wallet2, "Name" , airline1, airline1.address),
            registerAirlineTx(chain, wallet2, airline1.address),
            fundAirlineTx(chain, wallet2, wallet2.address),
        ]);
        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, 2);
        // console.log("fund::::", block)
        // console.log(block.receipts[0].events)
        // console.log(chain.getAssetsMaps())
        //block.receipts[0].result.expectErr().expectUint(1001);
        //
        //let check = readIsWhitelisted(chain, deployer);
        //check.result.expectBool(false);
    },
});