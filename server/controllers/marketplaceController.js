import { buyMarketplaceListingForUser, cancelMarketplaceListingForUser, createMarketplaceListingForUser, getMarketplaceForUser } from "../services/marketplaceService.js";
export async function getMarketplace(req, res, next) { try { res.status(200).json(await getMarketplaceForUser(req.auth.user, req.query ?? {})); } catch (error) { next(error); } }
export async function createListing(req, res, next) { try { res.status(200).json(await createMarketplaceListingForUser(req.auth.user, req.body ?? {})); } catch (error) { next(error); } }
export async function buyListing(req, res, next) { try { res.status(200).json(await buyMarketplaceListingForUser(req.auth.user, req.params.listingId)); } catch (error) { next(error); } }
export async function cancelListing(req, res, next) { try { res.status(200).json(await cancelMarketplaceListingForUser(req.auth.user, req.params.listingId)); } catch (error) { next(error); } }
