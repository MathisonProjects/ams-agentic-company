class HumanResourcesDepartment {
    private config: any;
    private responsibilities: any;

    constructor() {
        this.config = require('./config.json') as any;
        this.responsibilities = require('./README.md') as any;
    }
}

export default HumanResourcesDepartment;
