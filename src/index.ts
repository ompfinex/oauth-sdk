export namespace OMPFinex {
    const OMPFINEX_ORIGIN = 'https://my.ompfinex.com';
    const OAUTH2_URL = (applicationId: string) => `${OMPFINEX_ORIGIN}/oauth2/${applicationId}`;

    interface OAuthResponse {
        status: 'OK';
        data: {
            token: string;
        };
    }

    interface OAuthError {
        status: 'FAILED';
        error: string;
    }

    class OMPFinexAuth {
        private popup: Window | null = null;
        private sendingOriginInterval: number | null = null;
        private monitorPopupInterval: number | null = null;
        private resolveAuthentication!: (value: OAuthResponse) => void;
        private rejectAuthentication!: (reason?: OAuthError) => void;
        private readonly OAUTH2_URL: string;

        constructor(applicationId: string) {
            this.OAUTH2_URL = OAUTH2_URL(applicationId);
        }

        private openPopup(url: string, width: number, height: number): Window | null {
            const left = screen.width / 2 - width / 2;
            const top = screen.height / 2 - height / 2;
            return window.open(
                url,
                'ompfinex_oauth2',
                `width=${width},height=${height},top=${top},left=${left}`
            );
        }

        private sendMessageToPopup() {
            this.sendingOriginInterval = window.setInterval(() => {
                if (this.popup) {
                    this.popup.postMessage(
                        {url: window.location.origin, type: 'ompfinex_oauth2_origin_url'},
                        OMPFINEX_ORIGIN
                    );
                }
            }, 1000);
        }

        private monitorPopup() {
            this.monitorPopupInterval = window.setInterval(() => {
                if (!this.popup || this.popup.closed) {
                    this.cleanup();
                    this.rejectAuthentication({
                        status: 'FAILED',
                        error: 'USER_REJECTED',
                    });
                }
            }, 1000);
        }

        private handleMessage(event: MessageEvent) {
            if (event.origin !== OMPFINEX_ORIGIN) {
                return;
            }
            if (event.data.type === 'url_received') {
                if (this.sendingOriginInterval) {
                    clearInterval(this.sendingOriginInterval);
                }
            }

            if (event.data.type === 'ompfinex_oauth2_callback') {
                if (event.data.token) {
                    this.resolveAuthentication({
                        status: 'OK',
                        data: {
                            token: event.data.token,
                        },
                    });
                } else {
                    this.rejectAuthentication({
                        status: 'FAILED',
                        error: event.data.error,
                    });
                }
                this.cleanup();
            }
        }

        authenticate(): Promise<OAuthResponse> {
            return new Promise((resolve, reject) => {
                this.resolveAuthentication = resolve;
                this.rejectAuthentication = reject;

                this.popup = this.openPopup(this.OAUTH2_URL, 579, 700);
                this.sendMessageToPopup();
                this.monitorPopup();

                window.addEventListener('message', this.handleMessage.bind(this));
            });
        }

        private cleanup() {
            if (this.sendingOriginInterval) {
                clearInterval(this.sendingOriginInterval);
            }
            if (this.monitorPopupInterval) {
                clearInterval(this.monitorPopupInterval);
            }
            window.removeEventListener('message', this.handleMessage.bind(this));
            if (this.popup && !this.popup.closed) {
                this.popup.close();
            }
        }
    }

    export function authenticate(applicationId: string): Promise<OAuthResponse> {
        const authInstance = new OMPFinexAuth(applicationId);
        return authInstance.authenticate();
    }
}
