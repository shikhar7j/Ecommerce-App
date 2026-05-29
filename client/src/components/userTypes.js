import { User, Store, Building2 } from "lucide-react";

const userTypes = [
    {
        type: 'customer',
        label: 'Customer',
        icon: User,
        description: 'Individual buyers and consumers'
    },
    {
        type: 'retailer',
        label: 'Retailer',
        icon: Store,
        description: 'Store owners and merchants'
    },
    {
        type: 'wholesaler',
        label: 'Wholesaler',
        icon: Building2,
        description: 'Bulk suppliers and distributors'
    }
];

export default userTypes;