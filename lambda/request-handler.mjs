import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({});

const allowedOrigins = new Set([
	'https://www.taichiguru.com',
	'http://localhost:8080',
	'http://127.0.0.1:8080',
]);

const toEmail = process.env.TO_EMAIL || 'vnikron@gmail.com';
const fromEmail = process.env.FROM_EMAIL || 'support@taichiguru.com';
const subjectPrefix = process.env.SUBJECT_PREFIX || '[Tai Chi Guru]';

function headers(origin) {
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
			website: params.get('website') || '',
		};
	}

	return JSON.parse(rawBody);
}

function clean(value) {
	return String(value || '').trim();
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

	if (!validEmail(contactEmail))
		return response(400, { ok: false, message: 'Please enter a valid contact email.' }, origin);

	if (!comments)
		return response(400, { ok: false, message: 'Please add Tai Chi set comments.' }, origin);

	const body = [
		'New Tai Chi Guru set request',
		'',
		...(contactName ? [`Name: ${contactName}`] : []),
		`Contact email: ${contactEmail}`,
		'',
		'Tai Chi set comments:',
		comments,
		'',
		`Source: ${data.source || 'tai-chi-guru-request-form'}`,
		`Sent from: ${event.headers?.host || event.headers?.Host || 'unknown host'}`,
		`Date: ${new Date().toUTCString()}`,
	].join('\n');

	try {
		const result = await ses.send(new SendEmailCommand({
			FromEmailAddress: fromEmail,
			Destination: {
				ToAddresses: [toEmail],
			},
			ReplyToAddresses: [contactEmail],
			Content: {
				Simple: {
					Subject: {
						Charset: 'UTF-8',
						Data: `${subjectPrefix} New Tai Chi set request`,
					},
					Body: {
						Text: {
							Charset: 'UTF-8',
							Data: body,
						},
					},
				},
			},
		}));

		return response(200, { ok: true, messageId: result.MessageId }, origin);
	} catch (error) {
		console.error('SES send failed', error);
		return response(502, { ok: false, message: 'Email could not be sent.' }, origin);
	}
}
