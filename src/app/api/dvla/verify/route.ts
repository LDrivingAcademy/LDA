import { isRateLimited, jsonNoStore, rateLimitResponse } from "@/lib/security";

type DvlaVerifyRequest = {
  drivingLicenceNumber?: string;
  permissionConfirmed?: boolean;
};

function normaliseLicence(value?: string) {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function POST(request: Request) {
  if (isRateLimited(request, "dvla-verify", 10)) {
    return rateLimitResponse();
  }

  const body = (await request.json()) as DvlaVerifyRequest;
  const drivingLicenceNumber = normaliseLicence(body.drivingLicenceNumber);

  if (!body.permissionConfirmed) {
    return jsonNoStore(
      { valid: false, message: "Permission is required before checking DVLA data." },
      { status: 400 }
    );
  }

  if (!/^[A-Z0-9]{16}$/.test(drivingLicenceNumber)) {
    return jsonNoStore(
      { valid: false, message: "Enter a valid 16-character GB photocard driving licence number." },
      { status: 400 }
    );
  }

  const dvlaApiKey = process.env.DVLA_ACCESS_TO_DRIVER_DATA_API_KEY;
  const dvlaJwt = process.env.DVLA_ACCESS_TO_DRIVER_DATA_JWT;
  const endpoint =
    process.env.DVLA_ACCESS_TO_DRIVER_DATA_URL ??
    "https://driver-vehicle-licensing.api.gov.uk/full-driver-enquiry/v1/driving-licences/retrieve";

  if (!dvlaApiKey || !dvlaJwt) {
    return jsonNoStore({
      valid: true,
      mode: "demo",
      message:
        "Demo licence check passed. Add authorised DVLA Access to Driver Data API credentials for live database verification."
    });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dvlaJwt}`,
      "Content-Type": "application/json",
      "X-API-Key": dvlaApiKey
    },
    body: JSON.stringify({
      drivingLicenceNumber,
      includeCPC: false,
      includeTacho: false,
      acceptPartialResponse: false
    })
  });

  if (!response.ok) {
    return jsonNoStore(
      { valid: false, mode: "live", message: "DVLA could not verify that licence number." },
      { status: 400 }
    );
  }

  return jsonNoStore({
    valid: true,
    mode: "live",
    message: "DVLA live check passed."
  });
}
