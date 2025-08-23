import StrategicPlanningDepartment from './strategic-planning';
import AnalyticsDepartment from './analytics';
import ProductDepartment from './product';
import MarketingDepartment from './marketing';
import SalesDepartment from './sales';
import FinanceDepartment from './finance';
import HumanResourcesDepartment from './human-resources';
import DesignDepartment from './design';
import BrandingDepartment from './branding';
import CustomerSupportDepartment from './customer-support';
import QualityAssuranceDepartment from './quality-assurance';
import ScrumDepartment from './scrum';
import ResearchDepartment from './research';
import LegalDepartment from './legal';

const departments = [
    {
        name: 'Analytics',
        description: 'Analytics department',
        department: new AnalyticsDepartment(),
        id: 'analytics',
    },
    {
        name: 'Strategic Planning',
        description: 'Strategic planning department',
        department: new StrategicPlanningDepartment(),
        id: 'strategic-planning',
    },
    {
        name: 'Product',
        description: 'Product department',
        department: new ProductDepartment(),
        id: 'product',
    },
    {
        name: 'Quality Assurance',
        description: 'Quality assurance department',
        department: new QualityAssuranceDepartment(),
        id: 'quality-assurance',
    },
    {
        name: 'Scrum',
        description: 'Scrum department',
        department: new ScrumDepartment(),
        id: 'scrum',
    },
    {
        name: 'Branding',
        description: 'Branding department',
        department: new BrandingDepartment(),
        id: 'branding',
    },
    {
        name: 'Customer Support',
        description: 'Customer support department',
        department: new CustomerSupportDepartment(),
        id: 'customer-support',
    },
    {
        name: 'Design',
        description: 'Design department',
        department: new DesignDepartment(),
        id: 'design',
    },
    {
        name: 'Finance',
        description: 'Finance department',
        department: new FinanceDepartment(),
        id: 'finance',
    },
    {
        name: 'Human Resources',
        description: 'Human resources department',
        department: new HumanResourcesDepartment(),
        id: 'human-resources',
    },
    {
        name: 'Sales',
        description: 'Sales department',
        department: new SalesDepartment(),
        id: 'sales',
    },
    {
        name: 'Marketing',
        description: 'Marketing department',
        department: new MarketingDepartment(),
        id: 'marketing',
    },
    {
        name: 'Research',
        description: 'Research department',
        department: new ResearchDepartment(),
        id: 'research',
    },
    {
        name: 'Legal',
        description: 'Legal department',
        department: new LegalDepartment(),
        id: 'legal',
    }
];

export default departments;