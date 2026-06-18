(function(window, document) {
	'use strict';

	var form = document.getElementById('request-set-form');
	var submit = document.getElementById('request-submit');
	var success = document.getElementById('request-success');
	var error = document.getElementById('request-error');
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

	if (!form)
		return;

	var params = new URLSearchParams(window.location.search);
	if (params.get('sent') === '1')
		showStatus(success, 'Your request was sent. Thank you.');
	else if (params.get('sent') === '0')
		showStatus(error, params.get('message') || 'Your request could not be sent. Please try again.');

	form.addEventListener('submit', function(event) {
		if (!endpointReady()) {
			setSending(true);
			return;
		}

		event.preventDefault();

		var honeypot = document.getElementById('website');
		if (honeypot && honeypot.value)
			return;

		var contactEmail = document.getElementById('contact-email').value.trim();
		var comments = document.getElementById('tai-chi-comments').value.trim();

		if (!contactEmail || !comments) {
			showStatus(error, 'Please fill in your contact email and Tai Chi set comments.');
			return;
		}

		setSending(true);

		fetch(config.endpointUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'text/plain',
			},
			body: JSON.stringify({
				contactEmail: contactEmail,
				comments: comments,
				source: 'tai-chi-guru-request-form',
			}),
		})
			.then(function(response) {
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
			})
			.then(function() {
				form.reset();
				showStatus(success, 'Your request was sent. Thank you.');
			})
			.catch(function(fetchError) {
				showStatus(error, fetchError.message || 'Your request could not be sent. Please try again.');
			})
			.finally(function() {
				setSending(false);
			});
	});

})(window, document);
