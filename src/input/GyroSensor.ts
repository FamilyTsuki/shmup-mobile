/**
 * Reads the phone left/right tilt and forward/back tilt from DeviceOrientationEvent. One instance for the whole page:
 * the permission and the listener outlive the scenes.
 */
class GyroSensor {
    private _listening: boolean = false;
    private _hasData: boolean = false;
    private _tiltDeg: number = 0;
    private _neutralDeg: number = 0;
    private _pitchDeg: number = 0;
    private _neutralPitchDeg: number = 0;
    private _denied: boolean = false;

    /** The player or the browser refused the sensor during this visit: play with the finger instead */
    public get denied(): boolean {
        return this._denied;
    }

    /** True once the device sent at least one orientation event. Desktops expose the API without data. */
    public get hasData(): boolean {
        return this._hasData;
    }

    /** Left/right tilt in degrees relative to the calibrated neutral position, positive to the right */
    public get relativeTiltDeg(): number {
        return this._tiltDeg - this._neutralDeg;
    }

    /**
     * Forward/back tilt in degrees relative to the calibrated neutral position,
     * positive when the top of the phone comes toward the player
     */
    public get relativePitchDeg(): number {
        return this._pitchDeg - this._neutralPitchDeg;
    }

    public get isSupported(): boolean {
        return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    }

    /**
     * Must be called from a user gesture (tap): iOS only shows its permission prompt then.
     */
    public async requestAccess(): Promise<boolean> {
        const granted = await this.askPermission();
        this._denied = !granted;
        return granted;
    }

    private async askPermission(): Promise<boolean> {
        // Browsers only send orientation events to HTTPS pages
        if (!this.isSupported || !window.isSecureContext)
            return false;

        const orientationEvent = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
        if (typeof orientationEvent.requestPermission === 'function') {
            try {
                if (await orientationEvent.requestPermission() !== 'granted')
                    return false;
            } catch {
                return false;
            }
        }

        if (!this._listening) {
            window.addEventListener('deviceorientation', this.onOrientation);
            this._listening = true;
        }

        return true;
    }

    /** The current position becomes "no tilt" */
    public calibrate() {
        this._neutralDeg = this._tiltDeg;
        this._neutralPitchDeg = this._pitchDeg;
    }

    private readonly onOrientation = (event: DeviceOrientationEvent) => {
        if (event.gamma === null || event.beta === null)
            return;

        // In portrait gamma is the left/right tilt and beta the forward/back one; they swap when the screen is rotated
        switch (screen.orientation?.angle ?? 0) {
            case 90:
                this._tiltDeg = event.beta;
                this._pitchDeg = -event.gamma;
                break;
            case 180:
                this._tiltDeg = -event.gamma;
                this._pitchDeg = -event.beta;
                break;
            case 270:
                this._tiltDeg = -event.beta;
                this._pitchDeg = event.gamma;
                break;
            default:
                this._tiltDeg = event.gamma;
                this._pitchDeg = event.beta;
        }

        if (!this._hasData) {
            this._hasData = true;
            this.calibrate();
        }
    };
}

export default new GyroSensor();
