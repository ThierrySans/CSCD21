pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template PasswordWallet() {
    
    // private inputs
    signal input password;
    
    // public inputs
    signal input address;
    signal input amount;
    signal input nonce;
    
    // output (considered as public inputs)
    signal output passwordHash;
    signal output authHash;
    
    component passwordHasher = Poseidon(1);
    passwordHasher.inputs <== [password];
    passwordHash <== passwordHasher.out;
    
    component authHasher = Poseidon(4);
    authHasher.inputs <== [password, address, amount, nonce];
    authHash <== authHasher.out;
    
}

component main {public [address, amount, nonce]} = PasswordWallet();
