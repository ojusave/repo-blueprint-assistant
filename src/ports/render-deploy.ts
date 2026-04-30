/**
 * Port: Render Control Plane REST for web service create + deploy polling (/v1/services).
 * Implementation: RenderDeployRestAdapter in infra.
 */

export type CreateWebServiceResult = {
  service?: { id?: string; serviceDetails?: { url?: string } };
  deployId?: string;
};

export type DeployStatusPayload = {
  status?: string;
};

export type ServiceDetailsPayload = {
  serviceDetails?: { url?: string };
};

export interface RenderDeploy {
  createWebService(body: Record<string, unknown>): Promise<CreateWebServiceResult>;
  getDeploy(serviceId: string, deployId: string): Promise<DeployStatusPayload>;
  getService(serviceId: string): Promise<ServiceDetailsPayload>;
}
