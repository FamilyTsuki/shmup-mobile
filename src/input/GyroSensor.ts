/**
 * Reads the phone left/right tilt from DeviceOrientationEvent. One instance for the whole page:
 * the permission and the listener outlive the scenes.
 */
class GyroSensor {
    private _listening: boolean = false;
    private _hasData: boolean = false;
    private _tiltDeg: number = 0;
    private _neutralDeg: number = 0;

    /** True once the device sent at least one orientation event. Desktops expose the API without data. */
    public get hasData(): boolean {
        return this._hasData;
    }

    /** Left/right tilt in degrees relative to the calibrated neutral position, positive to the right */
    public get relativeTiltDeg(): number {
        return this._tiltDeg - this._neutralDeg;
    }

    public get isSupported(): boolean {
        return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    }

    /**
     * Must be called from a user gesture (tap): iOS only shows its permission prompt then.
     */
    public async requestAccess(): Promise<boolean> {
        if (!this.isSupported)
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
    }

    private readonly onOrientation = (event: DeviceOrientationEvent) => {
        if (event.gamma === null || event.beta === null)
            return;

        // gamma is the left/right tilt in portrait; the axes swap when the screen is rotated
        switch (screen.orientation?.angle ?? 0) {
            case 90:
                this._tiltDeg = event.beta;
                break;
            case 180:
                this._tiltDeg = -event.gamma;
                break;
            case 270:
                this._tiltDeg = -event.beta;
                break;
            default:
                this._tiltDeg = event.gamma;
        }

        if (!this._hasData) {
            this._hasData = true;
            this.calibrate();
        }
    };
}

export default new GyroSensor();
