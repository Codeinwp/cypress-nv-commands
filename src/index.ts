/// <reference types="cypress" />

Cypress.Commands.add('login', (nextRoute: string = null) => {
	cy.getCookies({
		log: true,
	}).then((cookies) => {
		let isLoggedIn = false;
		cookies.forEach((value) => {
			if (value.name.includes('wordpress_')) {
				isLoggedIn = true;
			}
		});

		if (isLoggedIn) {
			if (nextRoute !== null) {
				cy.visit(nextRoute);
			}
			return;
		}
		cy.visit('/wp-admin');
		cy.wait(500);
		cy.get('#user_login').type(Cypress.env('user'));
		cy.get('#user_pass').type(Cypress.env('password'));
		cy.get('#wp-submit').click();
		if (nextRoute === null) {
			return;
		}
		cy.visit(nextRoute);
	});
});

Cypress.Commands.add('clearWelcome', () => {
	cy.window().then((win) => {
		win.wp &&
			win.wp.data &&
			win.wp.data.select('core/edit-post').isFeatureActive('welcomeGuide') &&
			win.wp.data.dispatch('core/edit-post').toggleFeature('welcomeGuide');
	});
});

Cypress.Commands.add(
	'insertPost',
	(title = 'Test', content = 'Content', type = 'post', featured = false, tags = false) => {
		let loginRoute = '/wp-admin/post-new.php';
		if (type !== 'post') {
			loginRoute += '?post_type=' + type;
		}

		cy.loginWithRequest(loginRoute);
		cy.clearWelcome();
		if (featured) {
			cy.wait(1000);
			cy.get('button').contains('Featured image').click();
			cy.get('.editor-post-featured-image__toggle').click();
			cy.get('.media-frame').find('.media-menu-item').contains('Media Library').click({
				force: true,
			});

			cy.get('.attachments-browser .attachments > li.attachment').first().click({
				force: true,
			});
			cy.get('.media-button-select').click();
		}

		if (tags) {
			cy.get('.components-panel__body-toggle').contains('Tags').click({ force: true });
			cy.get('.components-form-token-field__label')
				.contains('Add New Tag')
				.parent()
				.find('input')
				.type('test-tag,', { force: true });
		}
		cy.get('.editor-post-title__input').type(title);
		cy.get(' textarea.block-editor-default-block-appender__content').click({
			force: true,
		});
		cy.get('.block-editor-rich-text__editable').type(content);
		cy.get('.editor-post-publish-panel__toggle').click();
		cy.updatePost();
	},
);

Cypress.Commands.add(
	'insertPostWithRequest',
	(title = 'Test Title', content = 'Test content', type = 'posts', featured = 0) => {
		cy.loginWithRequest();
		cy.getJWT().then(() => {
			cy.request({
				method: 'POST',
				url: '/wp-json/wp/v2/' + type,
				auth: {
					bearer: window.localStorage.getItem('jwt'),
				},
				body: {
					title,
					status: 'publish',
					content: {
						raw: content,
						rendered: 'The test content',
						protected: false,
					},
					featured_media: featured,
				},
			}).then((resp) => {
				expect(resp.status).to.eq(201);
				window.localStorage.setItem('postId', resp.body.id);
				window.localStorage.setItem('postUrl', '/' + resp.body.slug);
			});
		});
	},
);

Cypress.Commands.add('updatePost', () => {
	cy.get('.editor-post-publish-button').click();
	cy.wait(500);
});

Cypress.Commands.add('getCustomizerControl', (slug: string) => {
	cy.window().then((win) => {
		win.wp.customize.control(slug).focus();
	});
	return cy.get('#customize-control-' + slug);
});

Cypress.Commands.add('setCustomizeSettings', (to) => {
	cy.request('POST', '/wp-json/wpthememods/v1/settings', to);
});

Cypress.Commands.add('goToCustomizer', () => {
	cy.loginWithRequest('/wp-admin/customize.php');
	cy.visit('/wp-admin/customize.php');
	cy.window()
		.then((win) => {
			//If the customizer is not ready, bind the flag to ready event.
			win.wp.customize.bind('ready', () => {
				win.appReady = true;
			});
		})
		.then(() => {
			// If we bind to the ready event too late, we can check the body class 'ready'.
			cy.get('body').then(($body) => {
				if ($body.hasClass('ready')) {
					cy.window().then((win) => {
						win.appReady = true;
					});
				}
			});
		});
	cy.window({
		timeout: 15000,
	}).should('have.property', 'appReady', true);
});

Cypress.Commands.add('aliasRestRoutes', () => {
	cy.intercept('POST', '/wp-admin/admin-ajax.php').as('customizerSave');
});

Cypress.Commands.add('toggleElements', (show: boolean) => {
	const icon = show ? 'dashicons-hidden' : 'dashicons-visibility';
	cy.get('.ti-sortable-item-area .ti-sortable-item-toggle').each(function (el) {
		cy.get(el)
			.find('.dashicon')
			.then(($icon) => {
				if ($icon.hasClass(icon)) {
					cy.get($icon).click();
				}
			});
	});
});

Cypress.Commands.add('getControl', (control: string) => {
	return cy.get(`label[for=${control}]`).parent();
});

Cypress.Commands.add('activateCheckbox', (checkboxSelector: string, checkboxText: string) => {
	cy.get(checkboxSelector)
		.contains(checkboxText)
		.prev()
		.then((checkbox) => {
			if (!checkbox.hasClass('is-checked')) {
				cy.get(checkbox).click();
			}
		});
});

Cypress.Commands.add('openNeveSidebar', () => {
	cy.get('button.components-button[aria-label="Neve Options"]').click();
});

Cypress.Commands.add('activateClassicEditorPlugin', () => {
	cy.loginWithRequest('/wp-admin/plugins.php');
	cy.get('#activate-classic-editor').contains('Activate').click();
	cy.get('#deactivate-classic-editor').should('exist');
});

Cypress.Commands.add('deactivateClassicEditorPlugin', () => {
	cy.loginWithRequest('/wp-admin/plugins.php');
	cy.get('#deactivate-classic-editor').contains('Deactivate').click();
	cy.get('#activate-classic-editor').should('exist');
});

Cypress.Commands.add('getJWT', () => {
	cy.request('POST', '/wp-json/api-bearer-auth/v1/login', {
		username: 'admin',
		password: 'admin',
	}).then((response) => {
		expect(response.body.access_token).to.exist;
		window.localStorage.setItem('jwt', response.body.access_token);
	});
});

Cypress.Commands.add('updatePageOrPostByRequest', (postId: string, type: string, body) => {
	cy.getJWT().then(() => {
		cy.request({
			method: 'POST',
			url: '/wp-json/wp/v2/' + type + '/' + postId,
			auth: {
				bearer: window.localStorage.getItem('jwt'),
			},
			body,
		});
	});
});