(function(window, document) {
	'use strict';

	var form = document.getElementById('request-set-form') || document.getElementById('footer-contact-form');
	var isFooterForm = form && form.id === 'footer-contact-form';
	var submit = document.getElementById(isFooterForm ? 'footer-submit' : 'request-submit');
	var success = document.getElementById(isFooterForm ? 'footer-success' : 'request-success');
	var error = document.getElementById(isFooterForm ? 'footer-error' : 'request-error');
	var config = window.TaiChiGuruRequestConfig || {};

	function showStatus(target, message) {
		if (success)
			success.style.display = 'none';

		if (error)
			error.style.display = 'none';

		if (!target)
			return;

		if (message)
			target.textContent = message;

		target.style.display = 'block';
		target.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function setSending(isSending) {
		if (!submit)
			return;

		submit.disabled = isSending;
		submit.value = isSending ? 'Sending...' : 'Send';
	}

	function endpointReady() {
		return config.endpointUrl
			&& config.endpointUrl.indexOf('YOUR_LAMBDA_FUNCTION_URL_HERE') === -1;
	}

	function getResponseMessage(response, text, data) {
		if (data.message)
			return data.message;

		if (text)
			return text;

		return 'Request service returned HTTP ' + response.status + '.';
	}

	function sendRequest(contactEmail, comments, contactName, source, useNoCors) {
		var options = {
			method: 'POST',
			body: JSON.stringify({
				contactName: contactName,
				contactEmail: contactEmail,
				comments: comments,
				source: source,
			}),
		};

		if (useNoCors) {
			options.mode = 'no-cors';
		} else {
			options.headers = {
				'Content-Type': 'text/plain',
			};
		}

		return fetch(config.endpointUrl, options)
			.then(function(response) {
				if (response.type === 'opaque')
					return {};

				return response.text().then(function(text) {
					var data = {};

					try {
						data = text ? JSON.parse(text) : {};
					} catch (parseError) {
						data = {};
					}

					if (!response.ok || data.ok === false)
						throw new Error(getResponseMessage(response, text, data));

					return data;
				});
			});
	}

	if (!form)
		return;

	var params = new URLSearchParams(window.location.search);
	if (params.get('sent') === '1')
		showStatus(success, isFooterForm ? 'Your message was sent. Thank you.' : 'Your request was sent. Thank you.');
	else if (params.get('sent') === '0')
		showStatus(error, params.get('message') || (isFooterForm ? 'Your message could not be sent. Please try again.' : 'Your request could not be sent. Please try again.'));

	form.addEventListener('submit', function(event) {
		if (!endpointReady()) {
			setSending(true);
			return;
		}

		event.preventDefault();

		var honeypot = document.getElementById('website');
		if (honeypot && honeypot.value)
			return;

		var contactName = isFooterForm ? document.getElementById('name').value.trim() : '';
		var contactEmail = document.getElementById(isFooterForm ? 'email' : 'contact-email').value.trim();
		var comments = document.getElementById(isFooterForm ? 'message' : 'tai-chi-comments').value.trim();
		var source = isFooterForm ? 'tai-chi-guru-footer-form' : 'tai-chi-guru-request-form';

		if (!contactEmail || !comments) {
			showStatus(error, isFooterForm ? 'Please fill in your email and message.' : 'Please fill in your contact email and Tai Chi set comments.');
			return;
		}

		setSending(true);

		sendRequest(contactEmail, comments, contactName, source, false)
			.catch(function(fetchError) {
				if (fetchError instanceof TypeError)
					return sendRequest(contactEmail, comments, contactName, source, true);

				throw fetchError;
			})
			.then(function() {
				form.reset();
				showStatus(success, isFooterForm ? 'Your message was sent. Thank you.' : 'Your request was sent. Thank you.');
			})
			.catch(function(fetchError) {
				showStatus(error, fetchError.message || (isFooterForm ? 'Your message could not be sent. Please try again.' : 'Your request could not be sent. Please try again.'));
			})
			.finally(function() {
				setSending(false);
			});
	});

})(window, document);
