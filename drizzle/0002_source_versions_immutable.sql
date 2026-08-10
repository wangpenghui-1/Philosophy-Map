CREATE TRIGGER "source_versions_published_immutable"
BEFORE UPDATE OR DELETE ON "source_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_published_version_mutation();
