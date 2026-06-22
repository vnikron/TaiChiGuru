Massively by HTML5 UP
html5up.net | @ajlkn
Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)


This is Massively, a text-heavy, article-oriented design built around a huge background
image (with a new parallax implementation I'm testing) and scroll effects (powered by
Scrollex). A *slight* departure from all the one-pagers I've been doing lately, but one
that fulfills a few user requests and makes use of some new techniques I've been wanting
to try out. Enjoy it :)

Demo images* courtesy of Unsplash, a radtastic collection of CC0 (public domain) images
you can use for pretty much whatever.

(* = not included)

AJ
aj@lkn.io | @ajlkn


Credits:

	Demo Images:
		Unsplash (unsplash.com)

	Icons:
		Font Awesome (fontawesome.io)

	Other:
		jQuery (jquery.com)
		Scrollex (github.com/ajlkn/jquery.scrollex)
		Responsive Tools (github.com/ajlkn/responsive-tools)


Tai Chi Guru email forms:

	Run locally with PHP from the site root:

		php -S localhost:8000

	Copy config/email.config.example.php to config/email.config.php and fill in
	the real SMTP password before sending live mail. The PHP handler uses the
	settings in that file and is ignored by Git.

	The request page and the footer contact form both post to send-request.php.
	By default, assets/js/request-config.js leaves endpointUrl blank so the
	request page uses the PHP handler.

	Optional Lambda mode:

	Set assets/js/request-config.js endpointUrl to an AWS Lambda Function URL or
	API Gateway endpoint to submit JSON with JavaScript instead of PHP.

	Deploy lambda/request-handler.mjs as the Lambda handler. It uses the
	Lambda execution role to call the SES v2 HTTPS API directly, so no npm
	dependencies need to be bundled with the function. Set these environment
	variables if you need values other than the defaults:

		FROM_EMAIL=support@taichiguru.com
		TO_EMAIL=vnikron@gmail.com
		SUBJECT_PREFIX=[Tai Chi Guru]
		HANDLER_CORS=1

	The Lambda execution role needs permission to call ses:SendEmail or
	ses:SendEmailV2. In SES sandbox mode, both FROM_EMAIL and TO_EMAIL must be
	verified identities. The handler returns ok:true only after SES accepts the
	email request.

	Leave the Lambda Function URL CORS setting enabled by default. If you disable
	Function URL CORS, set HANDLER_CORS=1 so the handler returns the CORS headers
	itself. Do not enable both Function URL CORS and handler-managed CORS;
	duplicate Access-Control-Allow-Origin headers can break browser submissions.
