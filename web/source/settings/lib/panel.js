/*
	GoToSocial
	Copyright (C) 2021-2022 GoToSocial Authors admin@gotosocial.org

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

const Promise = require("bluebird");
const React = require("react");
const ReactDom = require("react-dom");

const oauthLib = require("./oauth");

module.exports = function createPanel(clientName, scope, Component) {
	ReactDom.render(<Panel/>, document.getElementById("root"));

	function Panel() {
		const [oauth, setOauth] = React.useState();
		const [hasAuth, setAuth] = React.useState(false);
		const [oauthState, setOauthState] = React.useState(localStorage.getItem("oauth"));

		React.useEffect(() => {
			let state = localStorage.getItem("oauth");
			if (state != undefined) {
				state = JSON.parse(state);
				let restoredOauth = oauthLib(state.config, state);
				Promise.try(() => {
					return restoredOauth.callback();
				}).then(() => {
					setAuth(true);
				});
				setOauth(restoredOauth);
			}
		}, [setAuth, setOauth]);

		if (!hasAuth && oauth && oauth.isAuthorized()) {
			setAuth(true);
		}

		if (oauth && oauth.isAuthorized()) {
			return <Component oauth={oauth} />;
		} else if (oauthState != undefined) {
			return "processing oauth...";
		} else {
			return <Auth setOauth={setOauth} />;
		}
	}

	function Auth({setOauth}) {
		const [ instance, setInstance ] = React.useState("");

		React.useEffect(() => {
			let isStillMounted = true;
			// check if current domain runs an instance
			let thisUrl = new URL(window.location.origin);
			thisUrl.pathname = "/api/v1/instance";
			Promise.try(() => {
				return fetch(thisUrl.href);
			}).then((res) => {
				if (res.status == 200) {
					return res.json();
				}
			}).then((json) => {
				if (json && json.uri && isStillMounted) {
					setInstance(json.uri);
				}
			}).catch((e) => {
				console.log("error checking instance response:", e);
			});

			return () => {
				// cleanup function
				isStillMounted = false;
			};
		}, []);

		function doAuth() {
			return Promise.try(() => {
				return new URL(instance);
			}).catch(TypeError, () => {
				return new URL(`https://${instance}`);
			}).then((parsedURL) => {
				let url = parsedURL.toString();
				let oauth = oauthLib({
					instance: url,
					client_name: clientName,
					scope: scope,
					website: window.location.href
				});
				setOauth(oauth);
				setInstance(url);
				return oauth.register().then(() => {
					return oauth;
				});
			}).then((oauth) => {
				return oauth.authorize();
			}).catch((e) => {
				console.log("error authenticating:", e);
			});
		}

		function updateInstance(e) {
			if (e.key == "Enter") {
				doAuth();
			} else {
				setInstance(e.target.value);
			}
		}

		return (
			<section className="login">
				<h1>OAUTH Login:</h1>
				<form onSubmit={(e) => e.preventDefault()}>
					<label htmlFor="instance">Instance: </label>
					<input value={instance} onChange={updateInstance} id="instance"/>
					<button onClick={doAuth}>Authenticate</button>
				</form>
			</section>
		);
	}
};