# Support ticket #1042: Purchase completed while auction was still open

**Status:** Open  
**Category:** Auctions / Checkout  
**Priority:** High

## Customer report

> I placed a bid on the mechanical keyboard and was the highest bidder. The auction still showed time remaining, but I was able to open checkout and confirm the purchase. My balance was charged and the item appeared in my orders, even though the auction hadn't finished. Shouldn't other people still have a chance to bid?

**Affected listing:** Mechanical keyboard auction  
**Listing URL:** `/post/11111111-1111-4111-8111-111111111111`

## Problem statement

A customer appears to have completed a purchase before the auction's closing time. Investigate how this can happen and fix the underlying issue.

The winning bidder should only be able to complete a purchase after the auction ends. An early purchase attempt should leave the customer's balance, seller's balance, orders, and listing unchanged. Purchasing an eligible item after its auction ends should continue to work.

## Investigation request

Create an account and use the local app to investigate the report. Reproduce the issue, identify the cause, and implement a fix.
