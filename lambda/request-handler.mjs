import { createHash, createHmac } from 'node:crypto';

const allowedOrigins = new Set([
	'https://taichiguru.com',
	'https://www.taichiguru.com',
	'http://localhost:8080',
	'http://127.0.0.1:8080',
]);

const toEmail = clean(process.env.TO_EMAIL || 'vnikron@gmail.com');
const fromEmail = clean(process.env.FROM_EMAIL || 'support@taichiguru.com');
const subjectPrefix = process.env.SUBJECT_PREFIX || '[Tai Chi Guru]';
const useHandlerCors = process.env.HANDLER_CORS === '1';

function headers(origin) {
	if (!useHandlerCors) {
		return {
			'content-type': 'application/json',
		};
	}

	const allowOrigin = allowedOrigins.has(origin) ? origin : 'https://www.taichiguru.com';

	return {
		'content-type': 'application/json',
		'access-control-allow-origin': allowOrigin,
		'access-control-allow-headers': 'content-type',
		'access-control-allow-methods': 'POST,OPTIONS',
		'vary': 'Origin',
	};
}

function response(statusCode, body, origin) {
	return {
		statusCode,
		headers: headers(origin),
		body: JSON.stringify(body),
	};
}

function parseBody(event) {
	const rawBody = event.isBase64Encoded
		? Buffer.from(event.body || '', 'base64').toString('utf8')
		: event.body || '';

	if (!rawBody)
		return {};

	const contentType = (event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').toLowerCase();

	if (contentType.includes('application/x-www-form-urlencoded')) {
		const params = new URLSearchParams(rawBody);
		return {
			contactName: params.get('contactName') || params.get('name') || '',
			contactEmail: params.get('contactEmail') || params.get('contact-email') || '',
			comments: params.get('comments') || params.get('tai-chi-comments') || '',
			avatarName: params.get('avatarName') || params.get('avatar-name') || '',
			source: params.get('source') || '',
			website: params.get('website') || '',
		};
	}

	return JSON.parse(rawBody);
}

function clean(value) {
	return String(value || '').trim();
}

function hash(value) {
	return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
	return createHmac('sha256', key).update(value).digest(encoding);
}

function getSignatureKey(secretKey, dateStamp, region, service) {
	const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
	const regionKey = hmac(dateKey, region);
	const serviceKey = hmac(regionKey, service);
	return hmac(serviceKey, 'aws4_request');
}

function amzDate(date) {
	return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

async function sendEmail(message) {
	const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ca-central-1';
	const accessKey = process.env.AWS_ACCESS_KEY_ID;
	const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
	const sessionToken = process.env.AWS_SESSION_TOKEN;

	if (!accessKey || !secretKey)
		throw new Error('Lambda AWS credentials are unavailable.');

	const service = 'ses';
	const host = `email.${region}.amazonaws.com`;
	const path = '/v2/email/outbound-emails';
	const endpoint = `https://${host}${path}`;
	const now = new Date();
	const dateTime = amzDate(now);
	const dateStamp = dateTime.slice(0, 8);
	const payload = JSON.stringify(message);
	const payloadHash = hash(payload);
	const canonicalHeaders = [
		`content-type:application/json`,
		`host:${host}`,
		`x-amz-date:${dateTime}`,
		...(sessionToken ? [`x-amz-security-token:${sessionToken}`] : []),
	].join('\n') + '\n';
	const signedHeaders = [
		'content-type',
		'host',
		'x-amz-date',
		...(sessionToken ? ['x-amz-security-token'] : []),
	].join(';');
	const canonicalRequest = [
		'POST',
		path,
		'',
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	].join('\n');
	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
	const stringToSign = [
		'AWS4-HMAC-SHA256',
		dateTime,
		credentialScope,
		hash(canonicalRequest),
	].join('\n');
	const signature = hmac(getSignatureKey(secretKey, dateStamp, region, service), stringToSign, 'hex');
	const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
	const requestHeaders = {
		'content-type': 'application/json',
		'x-amz-date': dateTime,
		'authorization': authorization,
	};

	if (sessionToken)
		requestHeaders['x-amz-security-token'] = sessionToken;

	const result = await fetch(endpoint, {
		method: 'POST',
		headers: requestHeaders,
		body: payload,
	});
	const text = await result.text();
	let data = {};

	try {
		data = text ? JSON.parse(text) : {};
	} catch (error) {
		data = { message: text };
	}

	if (!result.ok) {
		throw new Error(data.message || data.Message || `SES returned HTTP ${result.status}`);
	}

	return data;
}

function validEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handler(event) {
	const origin = event.headers?.origin || event.headers?.Origin || '';
	const method = event.requestContext?.http?.method || event.httpMethod || '';

	if (method === 'OPTIONS')
		return response(204, {}, origin);

	if (method !== 'POST')
		return response(405, { ok: false, message: 'Method Not Allowed' }, origin);

	let data;
	try {
		data = parseBody(event);
	} catch (error) {
		console.error('Could not parse request body', error);
		return response(400, { ok: false, message: 'Invalid request body' }, origin);
	}

	if (clean(data.website))
		return response(200, { ok: true }, origin);

	const contactEmail = clean(data.contactEmail);
	const contactName = clean(data.contactName);
	const comments = clean(data.comments);
	const avatarName = clean(data.avatarName);
	const isContactForm = data.source === 'tai-chi-guru-footer-form';

	if (!validEmail(contactEmail))
		return response(400, { ok: false, message: 'Please enter a valid contact email.' }, origin);

	if (!comments)
		return response(400, { ok: false, message: 'Please add Tai Chi set comments.' }, origin);

	const body = [
		isContactForm ? 'New Tai Chi Guru contact message' : 'New Tai Chi Guru set request',
		'',
		...(contactName ? [`Name: ${contactName}`] : []),
		...(!isContactForm ? [`selected avatar: ${avatarName || 'Not selected'}`] : []),
		`Contact email: ${contactEmail}`,
		'',
		isContactForm ? 'Message:' : 'Tai Chi set comments:',
		comments,
		'',
		`Source: ${data.source || 'tai-chi-guru-request-form'}`,
		`Sent from: ${event.headers?.host || event.headers?.Host || 'unknown host'}`,
		`Date: ${new Date().toUTCString()}`,
	].join('\n');

	try {
		const result = await sendEmail({
			FromEmailAddress: fromEmail,
			Destination: {
				ToAddresses: [toEmail],
			},
			ReplyToAddresses: [contactEmail],
			Content: {
				Simple: {
					Subject: {
						Charset: 'UTF-8',
						Data: `${subjectPrefix} ${isContactForm ? 'New contact message' : 'New Tai Chi set request'}`,
					},
					Body: {
						Text: {
							Charset: 'UTF-8',
							Data: body,
						},
					},
				},
			},
		});

		console.log('SES accepted message', {
			messageId: result.MessageId || result.MessageId,
			fromEmail,
			toEmail,
			source: data.source || 'tai-chi-guru-request-form',
		});

		return response(200, { ok: true, messageId: result.MessageId }, origin);
	} catch (error) {
		console.error('SES send failed', error);
		return response(502, { ok: false, message: 'Email could not be sent.' }, origin);
	}
}
