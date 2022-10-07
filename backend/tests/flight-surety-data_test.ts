
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const { uint, principal, bool, ascii, some } = types

const dataContract = 'flight-surety-data';
const appContract = 'flight-surety-app';


// read-only functions
const readIsWhitelisted = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(dataContract, "is-whitelisted", [principal(deployer.address.concat('.', appContract)),], deployer.address);

const hasAirlineState = (chain: Chain, airline: Account, sender: Account, state: number) =>
    chain.callReadOnlyFn(dataContract, "has-airline-state", [principal(airline.address),uint(state)], sender.address);

// public functions
const whitelistAppContract = (deployer: Account, sender: Account) => 
    Tx.contractCall(dataContract,'set-whitelisted',[principal(deployer.address.concat('.', appContract)), bool(true)], sender.address);

const applicationAirlineTx = (chain: Chain, airline: Account, airlineName: string , caller: Account, appSender: string) =>
    Tx.contractCall(dataContract, "application-airline", [principal(airline.address), some(ascii(airlineName)), principal(caller.address)], appSender );

const registerAirlineTx = (chain: Chain, airline: Account, caller: string) =>
    Tx.contractCall(dataContract, "register-airline", [principal(airline.address)], caller);

const fundAirlineTx = (chain: Chain, airline: Account, caller: string) =>
    Tx.contractCall(dataContract, "fund-airline", [principal(airline.address)], caller);



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

        let read = hasAirlineState(chain, airline1, deployer, 2)
        read.result.expectBool(true);

        read = hasAirlineState(chain, deployer, deployer, 2)
        read.result.expectBool(false);
    },
});

// airline to application
Clarinet.test({
    name: "Check registered airline can add new airline application (private register-airline-init)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let airline1 = accounts.get("airline_1")!;
        let airline2 = accounts.get("airline_2")!;

        let block = chain.mineBlock([
            applicationAirlineTx(chain, airline2, "Name" , airline1, deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        
        const values = block.receipts[0].result.expectOk().expectTuple()
        assertEquals(values, {'airline-state': uint(1), votes: uint(1)})
    },
});

Clarinet.test({
    name: "Check registered airline can add new airline application (private register-airline-init)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let airline1 = accounts.get("airline_1")!;
        let airline2 = accounts.get("airline_2")!;
        let block = chain.mineBlock([
            applicationAirlineTx(chain, airline2, "" , airline1, deployer.address),
            applicationAirlineTx(chain, airline2, "" , airline1, deployer.address)
        ]);
        console.log(block);
        console.log(block.receipts[0]);
        
        //assertEquals(block.receipts.length, 1);
        //assertEquals(block.height, 2);
        //
        //const values = block.receipts[0].result.expectOk().expectTuple()
        //assertEquals(values, {'airline-state': uint(1), votes: uint(1)})
    },
});
// airline register 

// airline funding

Clarinet.test({
    name: "Check application-airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let airline1 = accounts.get("airline_1")!;
        let airline2 = accounts.get("airline_2")!;
        let appCaller =  deployer.address.concat('.', appContract)

        let block = chain.mineBlock([
            applicationAirlineTx(chain, airline2, "Second airline" , airline2, airline1.address)
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
        let airline2 = accounts.get("airline_2")!;


        let block = chain.mineBlock([
            applicationAirlineTx(chain, airline2, "Name" , airline1, airline1.address),
            registerAirlineTx(chain, airline2, deployer.address)
        ]);
       
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
        let airline2 = accounts.get("airline_2")!;
        let appCaller =  deployer.address.concat('.', appContract)

        let block = chain.mineBlock([
            applicationAirlineTx(chain, airline2, "Name" , airline1, airline1.address),
            registerAirlineTx(chain, airline2, airline1.address),
            fundAirlineTx(chain, airline2, airline2.address),
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