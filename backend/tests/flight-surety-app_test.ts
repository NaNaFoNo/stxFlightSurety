
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const { uint, principal, bool, ascii, some } = types;

const dataContract = 'flight-surety-data';
const appContract = 'flight-surety-app';
const airlines = [ 'airline_1', 'airline_2', 'airline_3', 'airline_4', 'airline_5', 'airline_6']
const AIRLINE_FUNDING = 1000000;

function getAccounts ({accounts}: {accounts: Map<string, Account>}){
    const wallets = [ 'deployer', 'airline_1', 'airline_2', 'airline_3', 'airline_4', 'airline_5', 'airline_6']
    const [deployer, airline1, airline2, airline3, airline4, airline5, airline6] = wallets.map(name => accounts.get(name)!);

    return { deployer, airline1, airline2, airline3, airline4, airline5, airline6 };
}

const registeredAirlineCount = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "registered-airline-count", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const hasDataAccess = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "has-data-access", [], deployer.address);  // principal(deployer.address.concat('.', appContract))
    

const whitelistAppContract = (deployer: Account) =>
    Tx.contractCall(appContract, "whitelist-app-contract", [], deployer.address);  // principal(deployer.address.concat('.', appContract))



Clarinet.test({
    name: "Ensure that airline is registered on deployment and readable from app-contract",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer } = getAccounts({accounts})
        let read = registeredAirlineCount(chain, deployer ) 
        read.result.expectUint(1)
        read = hasDataAccess(chain, deployer)
        console.log(read)
        let block = chain.mineBlock([
            whitelistAppContract(deployer),
        ]);
        console.log(block)
        read = hasDataAccess(chain, deployer)
        console.log(read)
    },
});
