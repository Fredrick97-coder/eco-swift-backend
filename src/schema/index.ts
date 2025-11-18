import { gql } from 'apollo-server-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

// Read all .graphql files and combine them
const schemaFiles = globSync(join(__dirname, '**/*.graphql'));
const schemaStrings = schemaFiles.map((file) => readFileSync(file, 'utf-8'));

// If no schema files exist yet, use a basic one
export const typeDefs = schemaFiles.length > 0 
  ? gql`${schemaStrings.join('\n')}`
  : gql`
    type Query {
      hello: String
    }

    type Mutation {
      _empty: String
    }
  `;

