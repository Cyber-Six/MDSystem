const db = require('../../../../config/db');

const getPatientById = async (id) => {
    const result = await db.query(
        `SELECT * FROM patients WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
};

const adminResolver = {
    Query: {
        getPatients: async () => {
            const result = await db.query(`SELECT * FROM patients ORDER BY id DESC`);
            return result.rows;
        },

        getPatient: async (_, { id }) => {
            return await getPatientById(id);
        },

        getSuperiorPatients: async () => {
            const result = await db.query(
                `SELECT * FROM patients
                 WHERE superior_patient_id IS NULL
                 ORDER BY id DESC`
            );
            return result.rows;
        },

        getSubordinates: async (_, { superior_patient_id }) => {
            const result = await db.query(
                `SELECT * FROM patients
                 WHERE superior_patient_id = $1
                 ORDER BY id DESC`,
                [superior_patient_id]
            );
            return result.rows;
        },
    },

    Mutation: {
        setPatientAsSuperior: async (_, { patient_id }) => {
            const patient = await getPatientById(patient_id);
            if (!patient) throw new Error('Patient not found');

            const result = await db.query(
                `UPDATE patients
                 SET superior_patient_id = NULL
                 WHERE id = $1
                 RETURNING *`,
                [patient_id]
            );
            return result.rows[0];
        },

        assignSuperiorToPatient: async (_, { patient_id, superior_patient_id }) => {
            if (patient_id === superior_patient_id) {
                throw new Error('Patient cannot be their own superior');
            }

            const patient = await getPatientById(patient_id);
            if (!patient) throw new Error('Patient not found');

            const superior = await getPatientById(superior_patient_id);
            if (!superior) throw new Error('Superior patient not found');

            // Prevent circular hierarchy
            const cycleCheck = await db.query(
                `WITH RECURSIVE ancestors AS (
                    SELECT id, superior_patient_id
                    FROM patients
                    WHERE id = $1
                    UNION
                    SELECT p.id, p.superior_patient_id
                    FROM patients p
                    INNER JOIN ancestors a ON p.id = a.superior_patient_id
                )
                SELECT 1
                FROM ancestors
                WHERE id = $2
                LIMIT 1`,
                [superior_patient_id, patient_id]
            );

            if (cycleCheck.rowCount > 0) {
                throw new Error('Invalid assignment: circular superior relationship detected');
            }

            const result = await db.query(
                `UPDATE patients
                 SET superior_patient_id = $1
                 WHERE id = $2
                 RETURNING *`,
                [superior_patient_id, patient_id]
            );
            return result.rows[0];
        },

        removeSuperiorFromPatient: async (_, { patient_id }) => {
            const patient = await getPatientById(patient_id);
            if (!patient) throw new Error('Patient not found');

            const result = await db.query(
                `UPDATE patients
                 SET superior_patient_id = NULL
                 WHERE id = $1
                 RETURNING *`,
                [patient_id]
            );
            return result.rows[0];
        },
    },

    Patient: {
        superior: async (parent) => {
            if (!parent.superior_patient_id) return null;
            return await getPatientById(parent.superior_patient_id);
        },

        subordinates: async (parent) => {
            const result = await db.query(
                `SELECT * FROM patients
                 WHERE superior_patient_id = $1
                 ORDER BY id DESC`,
                [parent.id]
            );
            return result.rows;
        },
    },
};

module.exports = adminResolver;