import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Tokenico } from "../target/types/tokenico";
import {
  createMint,
  transfer,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { PublicKey, Keypair } from "@solana/web3.js";
import * as assert from "assert";


describe("tokenico", () => {
  //provider setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  //program configuration
  const program = anchor.workspace.Tokenico as Program<Tokenico>;

  //seeds
  const authoritySeed = Buffer.from("authority");
  const icoSeed = Buffer.from("ico");

  let mint: PublicKey;
  let authorityPda: PublicKey;
  let authorityBump: number;
  let icoPda: PublicKey;
  let icoBump: number;
  let icoTokenAccount: PublicKey;
  let userPDA: PublicKey;
  let userAta: PublicKey;

  const payer = provider.wallet.payer;

  //account creation
  const user = Keypair.generate();
  const treasury = Keypair.generate();
  const owner = Keypair.generate();
  const mintAuthority = Keypair.generate();
  const new_owner = Keypair.generate();

  before("sets up the token mint, PDA authority, ICO account", async () => {
    // Airdrop SOL to user so they can pay rent
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 5e9),
      "confirmed"
    );
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds delay

    // Airdrop SOL to treasury so they can pay rent
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(treasury.publicKey, 2e9),
      "confirmed"
    );
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds delay

    // Airdrop SOL to treasury so they can pay rent
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(owner.publicKey, 2e9),
      "confirmed"
    );
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds delay

    // Balance checking
    const userBalance = await provider.connection.getBalance(user.publicKey);
    console.log("User SOL balance:", userBalance / anchor.web3.LAMPORTS_PER_SOL);

    // Find PDA for authority
    [authorityPda, authorityBump] = await PublicKey.findProgramAddressSync(
      [authoritySeed],
      program.programId
    );

    // Find PDA for ico
    [icoPda, icoBump] = await PublicKey.findProgramAddressSync(
      [icoSeed],
      program.programId
    )

    userPDA = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), user.publicKey.toBuffer()],
      program.programId
    )[0]

    // Create SPL token mint
    mint = await createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      6 // decimals
    );

    // Create user ATA
    userAta = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        user.publicKey
      )
    ).address;

    // Create ICO ATA (authority's token account)
    icoTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        authorityPda,
        true // allow owner off curve
      )
    ).address;

    const tmpAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mint,
      payer.publicKey
    );

    await mintTo(
      provider.connection,
      payer,
      mint,
      tmpAta.address,
      mintAuthority,
      1_000_000_000_000
    );

    // Now transfer to ICO PDA ATA
    await transfer(
      provider.connection,
      payer,
      tmpAta.address,
      icoTokenAccount,
      payer, // ✅ the actual Keypair (signer)
      1_000_000_000_000
    );
  });

  it("initializes the user state", async () => {
    await program.methods
      .initialize(new anchor.BN(1 * 10 ** 9))
      .accounts({
        user: user.publicKey,
        icoAccount: icoPda,
        treasury: treasury.publicKey,
        owner: owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
  });

  it("allows user to buy tokens (lamports => SPL tokens)", async () => {
    const buyAmountTokens = new anchor.BN(0.1 * 10 ** 9); // 500 tokens (in smallest units)

    // Pre-check balances
    const beforeUserTokens = (await provider.connection.getTokenAccountBalance(userAta)).value.uiAmount;
    const beforeIcoTokens = (await provider.connection.getTokenAccountBalance(icoTokenAccount)).value.uiAmount;

    assert.equal(beforeUserTokens, 0);
    assert.equal(beforeIcoTokens! > 0, true);

    // Perform buy
    await program.methods
      .buy(buyAmountTokens)
      .accounts({
        user: user.publicKey,
        userAccount: userPDA,
        icoAccount: icoPda,
        mint,
        authority: authorityPda,
        icoTokenAccount,
        userTokenAccount: userAta,
        treasury: treasury.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user])
      .rpc();

    // Check updated token balances
    const afterUserTokens = (await provider.connection.getTokenAccountBalance(userAta)).value.uiAmount;
    const afterIcoTokens = (await provider.connection.getTokenAccountBalance(icoTokenAccount)).value.uiAmount;

    assert.equal(afterUserTokens, 0.1);
    assert.equal((beforeIcoTokens! - afterIcoTokens!).toFixed(4), 0.1);

    // Check user account state "amt"
    const userAccount = await program.account.user.fetch(userPDA);

    assert.equal(String(userAccount.usr), String(user.publicKey));
    assert.equal(String(userAccount.amt), (0.1 * 10 ** 6).toString());
  });

  it("update price", async () => {
    await program.methods
      .updatePrice(new anchor.BN(0.5 * 10 ** 9))
      .accounts({
        owner: owner.publicKey,
        icoAccount: icoPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
  });

  it("update treasury", async () => {
    const new_treasury = Keypair.generate();
    await program.methods
      .updateTreasury()
      .accounts({
        owner: owner.publicKey,
        icoAccount: icoPda,
        newTreasury: new_treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
  });

  it("update owner", async () => {
    await program.methods
      .transferOwnership()
      .accounts({
        owner: owner.publicKey,
        icoAccount: icoPda,
        newOwner: new_owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
  });

  it("update treasury", async () => {
    const new_treasury = Keypair.generate();
    await program.methods
      .updateTreasury()
      .accounts({
        owner: owner.publicKey,
        icoAccount: icoPda,
        newTreasury: new_treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
  });

  it("lets reading user amount via get_user_amount", async () => {
    const userAccountPda = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), user.publicKey.toBuffer()],
      program.programId
    )[0];

    const userAccount = await program.account.user.fetch(userAccountPda);
    // Assertion
    assert.equal(userAccount.amt.toString(), (0.1 * 10 ** 6).toString());
  });
});
