import * as yup from 'yup';

export function normalizePhone(value: string) { return value.replace(/[\s().-]/g, ''); }

function text(label: string) {
    return yup.string().trim().required(`${label} is required.`)
        .min(2, `${label}: minimum 2 characters.`)
        .max(500, `${label}: maximum 500 characters.`).label(label);
}
function phone(label: string) {
    return yup.string().trim().transform(value => typeof value === 'string' ? normalizePhone(value) : value)
        .required(`${label} is required.`)
        .matches(/^\+?[0-9]{7,15}$/, `${label}: use 7–15 digits; + is optional.`).label(label);
}
export const registrationSchema = yup.object({
    name: text('Full name'),
    phone: phone('Mobile number'),
    address: text('Home address'),
    occupation: text('Occupation'),
    officeAddress: text('Office address'),
    nationality: text('Nationality'),
    state: text('State of origin'),
    lga: text('Local government'),
    gender: yup.string().required('Gender is required.').oneOf(['Male', 'Female'], 'Select a gender.'),
    kinName: text('Next-of-kin name'),
    kinRelationship: text('Next-of-kin relationship'),
    kinAddress: text('Next-of-kin address'),
    kinPhone: phone('Next-of-kin mobile number'),
    kinEmail: yup.string().trim().lowercase().required('Next-of-kin email is required.')
        .email('Enter a valid next-of-kin email.').max(254, 'Next-of-kin email: maximum 254 characters.'),
});
export function validateRegistration(body: Record<string, unknown>) {
    // Reject non-text fields before Yup casts and normalizes values.
    for (const [key, value] of Object.entries(body)) {
        if (key in registrationSchema.fields && typeof value !== 'string')
            throw new yup.ValidationError(`${key} must be text.`, value, key);
    }
    return registrationSchema.validateSync(body, { stripUnknown: true });
}
