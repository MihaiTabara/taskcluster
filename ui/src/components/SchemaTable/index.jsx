import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { string } from 'prop-types';
import Spinner from '@mozilla-frontend-infra/components/Spinner';
import Table from 'material-ui-json-schema-viewer/build/SchemaViewer';
import jsonSchemaDraft06 from 'ajv/lib/refs/json-schema-draft-06.json';
import jsonSchemaDraft07 from 'ajv/lib/refs/json-schema-draft-07.json';
import ErrorPanel from '../ErrorPanel';
import references from '../../../../generated/references.json';

// Local copies of the json-schemas schemas, since TC schemas $refer to these
const EXTERNAL_SCHEMAS = [jsonSchemaDraft06, jsonSchemaDraft07].reduce(
  (schemas, schema) => ({ ...schemas, [schema.$id]: schema }),
  {}
);

@withRouter
/**
 * Display a SchemaTable
 */
export default class SchemaTable extends Component {
  static propTypes = {
    // The $id of the schema to render
    schema: string.isRequired,
  };

  state = {
    schema: null,
    references: [],
    error: null,
  };

  async componentDidMount() {
    const { schema } = this.props;

    /**
     * Fetch schema content by $id and update state
     */
    if (!this.state.schema && schema) {
      try {
        const schemaContent = await this.getSchemaContent(schema);

        this.setState({
          schema: schemaContent,
        });
      } catch (error) {
        this.setState({ error });
      }
    }

    /**
     *
     */
    try {
      const schemaReferences = await this.getSchemaReferences();

      this.setState({
        references: schemaReferences,
      });
    } catch (error) {
      this.setState({ error });
    }
  }

  async getSchemaContent(schemaPath) {
    const external = EXTERNAL_SCHEMAS[schemaPath];

    if (external) {
      return external;
    }

    const schema = references.find(({ content }) => content.$id === schemaPath);

    if (!schema) {
      throw new Error(`Cannot find ${schemaPath}.`);
    }

    return schema.content;
  }

  async getSchemaReferences() {
    const schemaReferences = references.map(schema => schema.content);

    Object.values(EXTERNAL_SCHEMAS).forEach(schema => {
      schemaReferences.push(schema);
    });

    return schemaReferences;
  }

  render() {
    const { error, schema, references } = this.state;

    if (error) {
      return <ErrorPanel error={error} />;
    }

    return schema ? (
      <Table schema={schema} references={references} />
    ) : (
      <Spinner loading />
    );
  }
}
