import React from 'react';
import {applyMiddleware, createStore} from "redux";
import combineReducers from "./store/reducers"
import {Provider} from "react-redux";
import createSagaMiddleware from 'redux-saga';
import logger from 'redux-logger';
import AuthContainer from "./components/AuthContainer";
import RegistrationContainer from "./components/RegistrationContainer";
import {Connected} from "./components/Connected";
import {watchLoadSignInData, watchLoadSignUpData} from "./store/sagas";
import {BrowserRouter as Router, Route, Switch, Redirect} from "react-router-dom";
import {loadDataToRequest, putDataFromServer, redirectToMainPage, unauthenticated} from "./store/auth/actions";
import MainContainer from "./components/MainContainer";
import wsc from "./components/WebSocketConnection";
import logo from './logo.svg';
import './App.css';

const sagaMiddleware = createSagaMiddleware();
export const store = createStore(combineReducers, applyMiddleware(logger, sagaMiddleware));


export default class App extends React.Component {
    constructor(props) {
        super(props);
        console.log("Creation wsc in App.jsx");
        this.state={
            ws: new wsc("ws://localhost:8081/ws").ws,
            connected: false
        };
        sagaMiddleware.run(watchLoadSignInData);
        sagaMiddleware.run(watchLoadSignUpData);
        this.onClose();
        this.Connect();
        this.getMessages();
    }
    Connect() {
        let that = this;
        this.state.ws.onopen = function () {
            console.log('Connected');
            // console.log(that.state.ws.url);
            that.setState({...that.state, connected:true});
            that.render()
        }
    }
    onClose(){
        let that = this;
        this.state.ws.onclose = function(event) {
            if (event.wasClean) {
                alert(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
            } else {
                setTimeout(()=>{
                    console.log("Connection died");
                    let ws2 = new WebSocket(that.state.ws.url);
                    ws2.onclose=that.state.ws.onclose;
                    ws2.onopen=that.state.ws.onopen;
                    ws2.onmessage=that.state.ws.onmessage;
                    that.setState({ws:ws2, connected:false});

                }, 1000)

            }
        };
    }
    getMessages() {
        let ws = this.state.ws;
        ws.onmessage = function (evt) {
            console.log("Message has been received");
            console.log(evt.data);
            let data = JSON.parse(evt.data);
            switch (data.type) {
                case "auth":
                    let content = JSON.parse(data.content);
                    store.dispatch(putDataFromServer(content));
                    store.dispatch(redirectToMainPage());
                    break;
                case "registration":
                    store.dispatch(loadDataToRequest(store.getState().registration, ws));
                    break;
                case "error":
                    alert(data.content);
                    break;
                default:
                    alert( "Unexpected type" );
            }
        };
    }

    render() {
        if (this.state.connected === false){
            return (
                <div className="App">
                    <header className="App-header">
                        <img src={logo} className="App-logo" alt="logo" />
                        <p>Подключение к серверу</p>
                    </header>
                </div>
            );
        } else {
            return (
                <Provider store={store}>
                    <Router>
                        <Switch>
                            <Route exact path="/">
                                <AuthContainer ws={this.state.ws}/>
                            </Route>
                            <Route exact path="/signUp">
                                <RegistrationContainer ws={this.state.ws}/>
                            </Route>
                            <Route exact path="/connected">
                                <Connected/>
                            </Route>
                            <PrivateRoute path="/main">
                                <MainContainer/>
                            </PrivateRoute>
                        </Switch>
                    </Router>

                </Provider>
            );
        }
    }
}

function PrivateRoute({children, ...rest}) {
            return (
                <Route
                    {...rest}
                    render={props =>
                        {
                            if (store.getState().auth.isAuthenticated === true) {
                                return children;
                            }else{
                                return <Redirect to={{pathname: "/"}} />;
                            }
                        }
                    }
                />
            );
}

