class ResearchDepartment {
    private config: any;
    private responsibilities: any;
    private io: any;

    constructor() {
        this.config = require('./config.json') as any;
        this.responsibilities = require('./README.md') as any;
        this.io = this.config.io;

        this.io.from = this.config.io.from;
        this.io.to = this.config.io.to;
    }
}

export default ResearchDepartment;
