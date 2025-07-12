use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_lang::system_program::{transfer, Transfer as SystemTransfer};


declare_id!("6utJEwmhwa51QVfi6PpH6AEgk27cfLBS3TGfGAVe9oCf");

#[program]
pub mod tokenico {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, price: u64) -> Result<()> {
        require!(price != 0, CustomError::InvalidAmount);

        let ico_account = &mut ctx.accounts.ico_account;
        ico_account.price = price;
        ico_account.treasury = ctx.accounts.treasury.key();
        ico_account.owner = ctx.accounts.owner.key();

        Ok(())
    }

    pub fn update_price(ctx : Context<UpdatePrice>, price: u64) -> Result<()> {
        let ico_account = &mut ctx.accounts.ico_account;
        ico_account.price = price;

        Ok(())
    }   

    pub fn transfer_ownership(ctx : Context<TransferOwnership>) -> Result<()> {
        let ico_account = &mut ctx.accounts.ico_account;
        ico_account.owner = ctx.accounts.new_owner.key();
        
        Ok(())
    }

    pub fn update_treasury(ctx : Context<UpdateTreasury>) -> Result<()> {
        let ico_account = &mut ctx.accounts.ico_account;
        ico_account.treasury = ctx.accounts.new_treasury.key();
        
        Ok(())
    }

    pub fn buy(ctx: Context<Buy>, lamports: u64) -> Result<()> {
        require!(lamports != 0, CustomError::InvalidAmount);
        
        let ico_account = &ctx.accounts.ico_account;
        require_keys_eq!(ctx.accounts.treasury.key(), ico_account.treasury);

        let total_amount = calculate_value(ico_account, lamports);

        let user_lamports = **ctx.accounts.user.to_account_info().lamports.borrow();

        require!(user_lamports >= lamports, CustomError::NotEnoughSol);
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                SystemTransfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            lamports,
        )?;

        let user_account = &mut ctx.accounts.user_account;
        user_account.usr = ctx.accounts.user.key();
        user_account.amt += total_amount;

        // Transfer SPL tokens using PDA as signer
        let seeds = &[b"authority".as_ref(), &[ctx.bumps.authority]];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.ico_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
                signer,
            ),
            total_amount,
        )?;

        Ok(())
    }
}

// ✅ Internal helper function, defined OUTSIDE the #[program] mod
fn calculate_value(ico_account: &Ico, amount: u64) -> u64 {
    // Use account state for calculation
    let token_value = amount *  10u64.pow(6) / ico_account.price;
    token_value
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + 8 + 32 + 32,
        seeds = [b"ico"],
        bump
    )]
    pub ico_account: Account<'info, Ico>,
    /// CHECK: Safe because it's only stored
    pub treasury: AccountInfo<'info>,
    /// CHECK: Safe because it's only stored
    pub owner: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 40,
        seeds = [b"user_account", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, User>,

    #[account(
        seeds = [b"ico"],
        bump
    )]
    pub ico_account: Account<'info, Ico>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA authority to sign for token transfer
    #[account(
        mut,
        seeds = [b"authority"],
        bump
    )]
    pub authority: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = authority
    )]
    pub ico_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    /// CHECK:
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"ico"],
        bump,
        has_one = owner,
    )]
    pub ico_account: Account<'info, Ico>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"ico"],
        bump,
        has_one = owner,
    )]
    pub ico_account: Account<'info, Ico>,
    /// CHECK: Safe because it's only stored
    pub new_owner: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateTreasury<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"ico"],
        bump,
        has_one = owner,
    )]
    pub ico_account: Account<'info, Ico>,
    /// CHECK: Safe because it's only stored
    pub new_treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct User {
    pub usr: Pubkey,
    pub amt: u64,
}

#[account]
pub struct Ico {
    pub price: u64,
    pub treasury: Pubkey,
    pub owner: Pubkey,
}

#[error_code]
pub enum CustomError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Not enough sol on account.")]
    NotEnoughSol,
}
