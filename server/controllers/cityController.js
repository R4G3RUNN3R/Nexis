import {
  acceptCityContractForUser,
  claimCityContractForUser,
  completeCityAcademyForUser,
  completeCityContractForUser,
  getCityAcademyForUser,
  getCityContractsForUser,
  getCityPeopleForUser,
  startCityAcademyForUser,
} from "../services/cityService.js";

export async function getCityPeople(req, res, next) {
  try {
    const result = await getCityPeopleForUser(req.auth.user, req.params.cityId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCityContracts(req, res, next) {
  try {
    const result = await getCityContractsForUser(req.auth.user, req.params.cityId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function acceptCityContract(req, res, next) {
  try {
    const result = await acceptCityContractForUser(req.auth.user, req.params.contractId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function completeCityContract(req, res, next) {
  try {
    const result = await completeCityContractForUser(req.auth.user, req.params.contractId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function claimCityContract(req, res, next) {
  try {
    const result = await claimCityContractForUser(req.auth.user, req.params.contractId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCityAcademy(req, res, next) {
  try {
    const result = await getCityAcademyForUser(req.auth.user, req.params.cityId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function startCityAcademy(req, res, next) {
  try {
    const result = await startCityAcademyForUser(req.auth.user, req.params.academyId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function completeCityAcademy(req, res, next) {
  try {
    const result = await completeCityAcademyForUser(req.auth.user, req.params.academyId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
