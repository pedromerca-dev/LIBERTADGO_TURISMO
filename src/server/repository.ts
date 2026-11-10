import { INITIAL_PLACES } from '../data/initialPlaces.ts';
import { INITIAL_CAMPAIGNS } from '../data/initialCampaigns.ts';
import { Place, TripItinerary, TripActivity, LocalCampaign, CampaignSubmission } from '../types/catalog.ts';
import { LA_LIBERTAD_LOCALITIES, Locality } from '../types/geo.ts';
import { isWithinLaLibertad, validateLocalityId, getLocality } from '../utils/geoBoundary.ts';
import { calculateTripDuration, formatDateRange } from '../utils/dateUtils.ts';
import { getPlaceRepository } from './repositories/placeRepository.ts';

class CatalogRepository {
  private places: Map<string, Place> = new Map();
  private itineraries: Map<string, TripItinerary> = new Map();
  private campaigns: Map<string, LocalCampaign> = new Map();

  constructor() {
    // Populate verified places catalog
    for (const place of INITIAL_PLACES) {
      if (isWithinLaLibertad(place.coordinates)) {
        this.places.set(place.id, place);
      }
    }

    // Populate initial creator campaigns for local businesses
    for (const campaign of INITIAL_CAMPAIGNS) {
      this.campaigns.set(campaign.id, campaign);
    }
  }

  // --- DESTINATIONS ---
  public getDestinations(): Locality[] {
    return LA_LIBERTAD_LOCALITIES;
  }

  public getDestinationById(id: string): Locality | undefined {
    return getLocality(id);
  }

  // --- PLACES & CATALOG ---
  public async getPlaces(filters?: { localityId?: string; category?: string; search?: string }): Promise<Place[]> {
    return await getPlaceRepository().getPublicPlaces(filters);
  }

  public async getPlaceById(id: string): Promise<Place | undefined> {
    const place = await getPlaceRepository().getPlaceById(id);
    if (!place || !isWithinLaLibertad(place.coordinates)) return undefined;
    // Strict public isolation: only PUBLISHED places can be retrieved via the public catalog
    if (place.status && place.status !== 'PUBLISHED') return undefined;
    return place;
  }

  public async searchPlaces(query: string, localityId?: string): Promise<Place[]> {
    return await getPlaceRepository().getPublicPlaces({ search: query, localityId });
  }

  // --- ITINERARIES ---
  public createItinerary(params: {
    destinationId: string;
    startDate: string;
    endDate: string;
    title?: string;
  }): { itinerary?: TripItinerary; error?: string } {
    if (!validateLocalityId(params.destinationId)) {
      return { error: 'El destino debe pertenecer a la región La Libertad, Perú' };
    }

    const locality = getLocality(params.destinationId);
    if (!locality) {
      return { error: 'Destino no encontrado en el catálogo de La Libertad' };
    }

    const duration = calculateTripDuration(params.startDate, params.endDate);
    if (!duration.isValid) {
      return { error: duration.error || 'Fechas de viaje inválidas' };
    }

    const id = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = params.title?.trim() || `Viaje a ${locality.name}`;

    const newItinerary: TripItinerary = {
      id,
      title,
      destinationId: locality.id,
      destinationName: locality.name,
      startDate: params.startDate,
      endDate: params.endDate,
      totalDays: duration.days,
      totalNights: duration.nights,
      coverImage: locality.heroImage,
      notes: '',
      savedPlaceIds: [],
      activities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.itineraries.set(id, newItinerary);
    return { itinerary: newItinerary };
  }

  public getItineraryById(id: string): TripItinerary | undefined {
    return this.itineraries.get(id);
  }

  public async addActivity(itineraryId: string, activityInput: {
    placeId: string;
    dayNumber: number;
    timeSlot?: string;
    notes?: string;
  }): Promise<{ activity?: TripActivity; error?: string }> {
    const itinerary = this.itineraries.get(itineraryId);
    if (!itinerary) return { error: 'Itinerario no encontrado' };

    const place = (await getPlaceRepository().getPlaceById(activityInput.placeId)) || this.places.get(activityInput.placeId);
    if (!place) return { error: 'Lugar no encontrado en el catálogo' };

    if (activityInput.dayNumber < 1 || activityInput.dayNumber > itinerary.totalDays) {
      return { error: `El día debe estar entre 1 y ${itinerary.totalDays}` };
    }

    const dayActivities = itinerary.activities.filter((a) => a.dayNumber === activityInput.dayNumber);
    const order = dayActivities.length + 1;

    const activity: TripActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tripId: itineraryId,
      placeId: place.id,
      place,
      dayNumber: activityInput.dayNumber,
      order,
      timeSlot: activityInput.timeSlot,
      notes: activityInput.notes,
      isVisited: false,
      createdAt: new Date().toISOString(),
    };

    itinerary.activities.push(activity);
    itinerary.updatedAt = new Date().toISOString();

    return { activity };
  }

  public removeActivity(itineraryId: string, activityId: string): boolean {
    const itinerary = this.itineraries.get(itineraryId);
    if (!itinerary) return false;

    const index = itinerary.activities.findIndex((a) => a.id === activityId);
    if (index === -1) return false;

    itinerary.activities.splice(index, 1);
    itinerary.updatedAt = new Date().toISOString();
    return true;
  }

  // --- LOCAL BUSINESS CAMPAIGNS WITH CREATORS ---
  public getCampaigns(filters?: {
    localityId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): LocalCampaign[] {
    let result = Array.from(this.campaigns.values());

    if (filters?.localityId && filters.localityId !== 'todas') {
      const locId = filters.localityId.toLowerCase().trim();
      result = result.filter((c) => c.localityId.toLowerCase() === locId);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.businessName.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.hashtags.some((h) => h.toLowerCase().includes(q))
      );
    }

    if (filters?.startDate) {
      result = result.filter((c) => c.endDate >= (filters.startDate as string));
    }

    if (filters?.endDate) {
      result = result.filter((c) => c.startDate <= (filters.endDate as string));
    }

    // Sort submissions by votes count descending for automatic leaderboard ranking
    return result.map((c) => ({
      ...c,
      submissions: [...c.submissions].sort((a, b) => b.votesCount - a.votesCount),
    }));
  }

  public getCampaignById(id: string): LocalCampaign | undefined {
    const c = this.campaigns.get(id);
    if (!c) return undefined;
    return {
      ...c,
      submissions: [...c.submissions].sort((a, b) => b.votesCount - a.votesCount),
    };
  }

  public createCampaign(data: Omit<LocalCampaign, 'id' | 'createdAt' | 'submissions'>): LocalCampaign {
    const id = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCampaign: LocalCampaign = {
      ...data,
      id,
      submissions: [],
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.campaigns.set(id, newCampaign);
    return newCampaign;
  }

  public addSubmission(
    campaignId: string,
    submissionData: Omit<CampaignSubmission, 'id' | 'campaignId' | 'submittedAt' | 'votesCount' | 'viewsCount' | 'status'>
  ): { submission?: CampaignSubmission; error?: string } {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return { error: 'Campaña no encontrada' };
    }

    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSubmission: CampaignSubmission = {
      ...submissionData,
      id,
      campaignId,
      votesCount: 1, // initial vote from author
      viewsCount: Math.floor(Math.random() * 500) + 100,
      submittedAt: new Date().toISOString(),
      status: 'approved',
    };

    campaign.submissions.push(newSubmission);
    return { submission: newSubmission };
  }

  public voteSubmission(campaignId: string, submissionId: string): { success: boolean; newVotes?: number; error?: string } {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return { success: false, error: 'Campaña no encontrada' };

    const submission = campaign.submissions.find((s) => s.id === submissionId);
    if (!submission) return { success: false, error: 'Envío de video no encontrado' };

    submission.votesCount += 1;
    submission.viewsCount += Math.floor(Math.random() * 20) + 5;

    return { success: true, newVotes: submission.votesCount };
  }
}

export const catalogRepository = new CatalogRepository();
